import fs from "fs"
import BN from "bn.js"
import {CONFIG_KEYS} from "./configKeys"
import {
  USDCDecimals,
  OWNER_ROLE,
  MINTER_ROLE,
  ZERO_ADDRESS,
  updateConfig,
  getUSDCAddress,
  isTestEnv,
  setInitialConfigVals,
  isMainnetForking,
  assertIsChainId,
  getProtocolOwner,
  getContract,
  ContractDeployer,
  DISTRIBUTOR_ROLE,
  TRUFFLE_CONTRACT_PROVIDER,
} from "./deployHelpers"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {DeployFunction} from "hardhat-deploy/types"
import {
  GoldfinchConfig,
  GoldfinchFactory,
  Fidu,
  GFI,
  TransferRestrictedVault,
  Borrower,
  SeniorPool,
  FixedLeverageRatioStrategy,
  DynamicLeverageRatioStrategy,
  CommunityRewards,
  MerkleDistributor,
  TestERC20,
  UniqueIdentity,
  Go,
  TestUniqueIdentity,
} from "../typechain/ethers"
import {Logger, DeployOpts} from "./types"
import {isMerkleDistributorInfo} from "./merkleDistributor/types"
import {
  CommunityRewardsInstance,
  GoInstance,
  UniqueIdentityInstance,
  MerkleDistributorInstance,
  TestERC20Instance,
  TestUniqueIdentityInstance,
} from "../typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import {StakingRewards} from "../typechain/ethers/StakingRewards"
import {UNIQUE_IDENTITY_METADATA_URI} from "./uniqueIdentity/constants"

let logger: Logger

type Deployed<T> = {
  name: string
  contract: T
}

const baseDeploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (isMainnetForking()) {
    return
  }
  const {getNamedAccounts, getChainId} = hre
  logger = console.log
  const deployer = new ContractDeployer(logger, hre)
  logger("Starting deploy...")
  const {gf_deployer} = await getNamedAccounts()
  logger("Will be deploying using the gf_deployer account:", gf_deployer)

  const chainId = await getChainId()
  assertIsChainId(chainId)
  logger("Chain id is:", chainId)
  const config = await deployConfig(deployer)
  await getOrDeployUSDC(deployer)
  const fidu = await deployFidu(deployer, config)
  await deployPoolTokens(deployer, {config})
  await deployTransferRestrictedVault(deployer, {config})
  const pool = await deployPool(deployer, {config})
  await deployTranchedPool(deployer, {config})
  logger("Granting minter role to Pool")
  await grantMinterRoleToPool(fidu, pool)
  const creditDesk = await deployCreditDesk(deployer, {config})
  await deploySeniorPool(deployer, {config, fidu})
  await deployBorrower(deployer, {config})
  await deploySeniorPoolStrategies(deployer, {config})
  logger("Deploying GoldfinchFactory")
  await deployGoldfinchFactory(deployer, {config})
  await deployClImplementation(deployer, {config})

  await deployGFI(deployer, {config})
  await deployLPStakingRewards(deployer, {config})
  const communityRewards = await deployCommunityRewards(deployer, {config})
  await deployMerkleDistributor(deployer, {communityRewards})

  const uniqueIdentity = await deployUniqueIdentity(deployer)
  await deployGo(deployer, {config, uniqueIdentity})

  logger("Granting ownership of Pool to CreditDesk")
  await grantOwnershipOfPoolToCreditDesk(pool, creditDesk.address)

  // Internal functions.

  async function deployConfig(deployer: ContractDeployer): Promise<GoldfinchConfig> {
    let contractName = "GoldfinchConfig"

    if (isTestEnv()) {
      contractName = "TestGoldfinchConfig"
    }

    assertIsString(gf_deployer)
    const config = (await deployer.deploy(contractName, {from: gf_deployer})) as GoldfinchConfig
    const checkAddress = await config.getAddress(CONFIG_KEYS.TreasuryReserve)
    if (checkAddress === ZERO_ADDRESS) {
      logger("Config newly deployed, initializing...")
      const protocol_owner = await getProtocolOwner()
      assertIsString(protocol_owner)
      await (await config.initialize(protocol_owner)).wait()
    }

    await setInitialConfigVals(config, logger)

    return config
  }

  async function getOrDeployUSDC(deployer: ContractDeployer) {
    assertIsChainId(chainId)
    let usdcAddress = getUSDCAddress(chainId)
    const protocolOwner = await getProtocolOwner()
    if (!usdcAddress) {
      logger("We don't have a USDC address for this network, so deploying a fake USDC")
      const initialAmount = String(new BN("100000000").mul(USDCDecimals))
      const decimalPlaces = String(new BN(6))
      assertIsString(gf_deployer)
      const fakeUSDC = await deployer.deploy("TestERC20", {
        from: gf_deployer,
        args: [initialAmount, decimalPlaces],
      })
      usdcAddress = fakeUSDC.address
      await (
        await getContract<TestERC20, TestERC20Instance>("TestERC20", TRUFFLE_CONTRACT_PROVIDER, {from: gf_deployer})
      ).transfer(protocolOwner, String(new BN(10000000).mul(USDCDecimals)))
    }
    await updateConfig(config, "address", CONFIG_KEYS.USDC, usdcAddress, logger)
    return usdcAddress
  }

  async function deployGoldfinchFactory(deployer: ContractDeployer, {config}: DeployOpts): Promise<GoldfinchFactory> {
    logger("Deploying goldfinch factory")
    assertIsString(gf_deployer)
    const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})
    const protocol_owner = await getProtocolOwner()

    const goldfinchFactory = await deployer.deploy("GoldfinchFactory", {
      from: gf_deployer,
      proxy: {
        owner: gf_deployer,
        execute: {
          init: {
            methodName: "initialize",
            args: [protocol_owner, config.address],
          },
        },
      },
      libraries: {
        ["Accountant"]: accountant.address,
      },
    })
    const goldfinchFactoryAddress = goldfinchFactory.address

    await updateConfig(config, "address", CONFIG_KEYS.GoldfinchFactory, goldfinchFactoryAddress, {logger})
    return goldfinchFactory as GoldfinchFactory
  }

  async function deployCreditDesk(deployer: ContractDeployer, {config}: DeployOpts) {
    const protocol_owner = await getProtocolOwner()
    assertIsString(gf_deployer)
    const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})

    let contractName = "CreditDesk"

    if (isTestEnv()) {
      contractName = "TestCreditDesk"
    }

    logger("Deploying CreditDesk")
    assertIsString(gf_deployer)
    const creditDesk = await deployer.deploy(contractName, {
      from: gf_deployer,
      proxy: {
        owner: gf_deployer,
        execute: {
          init: {
            methodName: "initialize",
            args: [protocol_owner, config.address],
          },
        },
      },
      libraries: {["Accountant"]: accountant.address},
    })
    await updateConfig(config, "address", CONFIG_KEYS.CreditDesk, creditDesk.address, {logger})
    return creditDesk
  }

  async function grantOwnershipOfPoolToCreditDesk(pool: any, creditDeskAddress: any) {
    const alreadyOwnedByCreditDesk = await pool.hasRole(OWNER_ROLE, creditDeskAddress)
    if (alreadyOwnedByCreditDesk) {
      // We already did this step, so early return
      logger("Looks like Credit Desk already is the owner")
      return
    }
    logger("Adding the Credit Desk as an owner")
    const txn = await pool.grantRole(OWNER_ROLE, creditDeskAddress)
    await txn.wait()
    const nowOwnedByCreditDesk = await pool.hasRole(OWNER_ROLE, creditDeskAddress)
    if (!nowOwnedByCreditDesk) {
      throw new Error(`Expected ${creditDeskAddress} to be an owner, but that is not the case`)
    }
  }

  async function deployFidu(deployer: ContractDeployer, config: GoldfinchConfig): Promise<Fidu> {
    logger("About to deploy Fidu...")
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const fidu = await deployer.deploy("Fidu", {
      from: gf_deployer,
      proxy: {
        execute: {
          init: {
            methodName: "__initialize__",
            args: [protocol_owner, "Fidu", "FIDU", config.address],
          },
        },
      },
    })
    const fiduAddress = fidu.address

    await updateConfig(config, "address", CONFIG_KEYS.Fidu, fiduAddress, {logger})
    return fidu as Fidu
  }

  async function deployGFI(deployer: ContractDeployer, {config}: {config: GoldfinchConfig}): Promise<GFI> {
    logger("About to deploy GFI...")
    assertIsString(gf_deployer)
    const initialCap = "100000000000000000000000000"
    const protocol_owner = await getProtocolOwner()
    const gfi = await deployer.deploy("GFI", {
      from: gf_deployer,
      gasLimit: 4000000,
      args: [
        protocol_owner, // owner
        "GFI", // name
        "GFI", // symbol
        initialCap, //initialCap
      ],
    })
    await updateConfig(config, "address", CONFIG_KEYS.GFI, gfi.address, {logger})
    return gfi as GFI
  }

  async function deployLPStakingRewards(
    deployer: ContractDeployer,
    {config}: {config: GoldfinchConfig}
  ): Promise<StakingRewards> {
    logger("About to deploy LPStakingRewards...")
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const stakingRewards = await deployer.deploy("StakingRewards", {
      from: gf_deployer,
      gasLimit: 4000000,
      proxy: {
        execute: {
          init: {
            methodName: "__initialize__",
            args: [protocol_owner, config.address],
          },
        },
      },
    })
    return stakingRewards as StakingRewards
  }

  async function deployCommunityRewards(
    deployer: ContractDeployer,
    {config}: {config: GoldfinchConfig}
  ): Promise<Deployed<CommunityRewardsInstance>> {
    const contractName = "CommunityRewards"
    logger(`About to deploy ${contractName}...`)
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const communityRewards = await deployer.deploy(contractName, {
      from: gf_deployer,
      gasLimit: 4000000,
      proxy: {
        execute: {
          init: {
            methodName: "__initialize__",
            args: [protocol_owner, config.address],
          },
        },
      },
    })
    const contract = await getContract<CommunityRewards, CommunityRewardsInstance>(
      contractName,
      TRUFFLE_CONTRACT_PROVIDER,
      {at: communityRewards.address}
    )

    return {name: contractName, contract}
  }

  async function getMerkleDistributorRoot(): Promise<string | undefined> {
    const path = process.env.MERKLE_DISTRIBUTOR_INFO_PATH
    if (!path) {
      logger("Merkle distributor info path is undefined.")
      return
    }
    const json = JSON.parse(fs.readFileSync(path, {encoding: "utf8"}))
    if (!isMerkleDistributorInfo(json)) {
      logger("Merkle distributor info json failed type guard.")
      return
    }
    return json.merkleRoot
  }

  async function deployMerkleDistributor(
    deployer: ContractDeployer,
    {
      communityRewards,
    }: {
      communityRewards: Deployed<CommunityRewardsInstance>
    }
  ): Promise<Deployed<MerkleDistributorInstance> | undefined> {
    const contractName = "MerkleDistributor"

    const merkleRoot = await getMerkleDistributorRoot()
    if (!merkleRoot) {
      logger(`Merkle root is undefined. Skipping deploy of ${contractName}`)
      return
    }

    logger(`About to deploy ${contractName}...`)
    assertIsString(gf_deployer)
    const merkleDistributor = await deployer.deploy(contractName, {
      from: gf_deployer,
      gasLimit: 4000000,
      args: [communityRewards.contract.address, merkleRoot],
    })
    const contract = await getContract<MerkleDistributor, MerkleDistributorInstance>(
      contractName,
      TRUFFLE_CONTRACT_PROVIDER,
      {at: merkleDistributor.address}
    )

    const deployed: Deployed<MerkleDistributorInstance> = {
      name: contractName,
      contract,
    }
    await grantDistributorRoleToMerkleDistributor(communityRewards, deployed)

    return deployed
  }

  async function deployUniqueIdentity(
    deployer: ContractDeployer
  ): Promise<Deployed<UniqueIdentityInstance | TestUniqueIdentityInstance>> {
    const contractName = isTestEnv() ? "TestUniqueIdentity" : "UniqueIdentity"
    logger(`About to deploy ${contractName}...`)
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const uniqueIdentity = await deployer.deploy(contractName, {
      from: gf_deployer,
      gasLimit: 4000000,
      proxy: {
        execute: {
          init: {
            methodName: "initialize",
            args: [protocol_owner, UNIQUE_IDENTITY_METADATA_URI],
          },
        },
      },
    })
    const contract = await getContract<
      UniqueIdentity | TestUniqueIdentity,
      UniqueIdentityInstance | TestUniqueIdentityInstance
    >(contractName, TRUFFLE_CONTRACT_PROVIDER, {at: uniqueIdentity.address})
    return {name: contractName, contract}
  }

  async function deployGo(
    deployer: ContractDeployer,
    {
      config,
      uniqueIdentity,
    }: {config: GoldfinchConfig; uniqueIdentity: Deployed<UniqueIdentityInstance | TestUniqueIdentityInstance>}
  ): Promise<Deployed<GoInstance>> {
    const contractName = "Go"
    logger(`About to deploy ${contractName}...`)
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const go = await deployer.deploy(contractName, {
      from: gf_deployer,
      gasLimit: 4000000,
      proxy: {
        execute: {
          init: {
            methodName: "initialize",
            args: [protocol_owner, config.address, uniqueIdentity.contract.address],
          },
        },
      },
    })
    const contract = await getContract<Go, GoInstance>(contractName, TRUFFLE_CONTRACT_PROVIDER, {
      at: go.address,
    })

    logger("Updating config...")
    await updateConfig(config, "address", CONFIG_KEYS.Go, contract.address, {logger})
    logger("Updated Go config address to:", contract.address)

    return {name: contractName, contract}
  }
}

async function grantDistributorRoleToMerkleDistributor(
  communityRewards: Deployed<CommunityRewardsInstance>,
  merkleDistributor: Deployed<MerkleDistributorInstance>
): Promise<void> {
  let hasDistributorRole = await communityRewards.contract.hasRole(DISTRIBUTOR_ROLE, merkleDistributor.contract.address)
  if (hasDistributorRole) {
    throw new Error(`${merkleDistributor.name} already has DISTRIBUTOR_ROLE on ${communityRewards.name}.`)
  }
  await communityRewards.contract.grantRole(DISTRIBUTOR_ROLE, merkleDistributor.contract.address)
  hasDistributorRole = await communityRewards.contract.hasRole(DISTRIBUTOR_ROLE, merkleDistributor.contract.address)
  if (hasDistributorRole) {
    logger(`Granted distributor role on ${communityRewards.name} to ${merkleDistributor.name}.`)
  } else {
    throw new Error(`Failed to grant DISTRIBUTOR_ROLE on ${communityRewards.name} to ${merkleDistributor.name}.`)
  }
}

async function grantMinterRoleToPool(fidu: Fidu, pool: any) {
  if (!(await fidu.hasRole(MINTER_ROLE, pool.address))) {
    await fidu.grantRole(MINTER_ROLE, pool.address)
  }
}

async function deployTranchedPool(deployer: ContractDeployer, {config}: DeployOpts) {
  const logger = console.log
  const {gf_deployer} = await deployer.getNamedAccounts()

  logger("About to deploy TranchedPool...")
  let contractName = "TranchedPool"

  if (isTestEnv()) {
    contractName = "TestTranchedPool"
  }

  assertIsString(gf_deployer)
  const tranchedPoolImpl = await deployer.deploy(contractName, {
    from: gf_deployer,
  })
  logger("Updating config...")
  await updateConfig(config, "address", CONFIG_KEYS.TranchedPoolImplementation, tranchedPoolImpl.address, {logger})
  logger("Updated TranchedPool config address to:", tranchedPoolImpl.address)
  return tranchedPoolImpl
}

async function deployClImplementation(deployer: ContractDeployer, {config}: DeployOpts) {
  const {gf_deployer} = await deployer.getNamedAccounts()

  assertIsString(gf_deployer)
  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})
  // Deploy the credit line as well so we generate the ABI
  assertIsString(gf_deployer)
  const clDeployResult = await deployer.deploy("CreditLine", {
    from: gf_deployer,
    libraries: {["Accountant"]: accountant.address},
  })
  await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, clDeployResult.address, {logger})
}

async function deployMigratedTranchedPool(deployer: ContractDeployer, {config}: DeployOpts) {
  const {gf_deployer} = await deployer.getNamedAccounts()

  logger("About to deploy MigratedTranchedPool...")
  const contractName = "MigratedTranchedPool"

  assertIsString(gf_deployer)
  const migratedTranchedPoolImpl = await deployer.deploy(contractName, {from: gf_deployer})

  await updateConfig(
    config,
    "address",
    CONFIG_KEYS.MigratedTranchedPoolImplementation,
    migratedTranchedPoolImpl.address,
    {logger}
  )
  return migratedTranchedPoolImpl
}

async function deployTransferRestrictedVault(
  deployer: ContractDeployer,
  {config}: DeployOpts
): Promise<TransferRestrictedVault> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const chainId = await deployer.getChainId()
  assertIsChainId(chainId)

  const contractName = "TransferRestrictedVault"

  logger(`About to deploy ${contractName}...`)
  const contract = await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocol_owner, config.address],
        },
      },
    },
  })
  return contract as TransferRestrictedVault
}

async function deployPoolTokens(deployer: ContractDeployer, {config}: DeployOpts) {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const chainId = await deployer.getChainId()
  assertIsChainId(chainId)

  let contractName = "PoolTokens"

  if (isTestEnv()) {
    contractName = "TestPoolTokens"
  }

  logger("About to deploy Pool Tokens...")
  const poolTokens = await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocol_owner, config.address],
        },
      },
    },
  })
  await updateConfig(config, "address", CONFIG_KEYS.PoolTokens, poolTokens.address, {logger})
  return poolTokens
}

async function deployPool(deployer: ContractDeployer, {config}: DeployOpts) {
  let contractName = "Pool"
  if (isTestEnv()) {
    contractName = "TestPool"
  }
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  assertIsString(gf_deployer)
  const pool = await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, config.address],
        },
      },
    },
  })
  await updateConfig(config, "address", CONFIG_KEYS.Pool, pool.address, {logger})

  return pool
}

async function deploySeniorPool(deployer: ContractDeployer, {config, fidu}: DeployOpts): Promise<SeniorPool> {
  let contractName = "SeniorPool"
  if (isTestEnv()) {
    contractName = "TestSeniorPool"
  }
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})
  const seniorPool = await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, config.address],
        },
      },
    },
    libraries: {["Accountant"]: accountant.address},
  })
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPool, seniorPool.address, {logger})
  await (await config.addToGoList(seniorPool.address)).wait()
  if (fidu) {
    logger(`Granting minter role to ${contractName}`)
    await grantMinterRoleToPool(fidu, seniorPool)
  }
  return seniorPool as SeniorPool
}

async function deployFixedLeverageRatioStrategy(
  deployer: ContractDeployer,
  {config}: DeployOpts
): Promise<FixedLeverageRatioStrategy> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "FixedLeverageRatioStrategy"

  assertIsString(gf_deployer)
  const strategy = await deployer.deploy(contractName, {
    from: gf_deployer,
  })
  await (await strategy.initialize(protocol_owner, config.address)).wait()
  return strategy as FixedLeverageRatioStrategy
}

async function deployDynamicLeverageRatioStrategy(deployer: ContractDeployer): Promise<DynamicLeverageRatioStrategy> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "DynamicLeverageRatioStrategy"

  assertIsString(gf_deployer)
  const strategy = await deployer.deploy(contractName, {
    from: gf_deployer,
  })
  await (await strategy.initialize(protocol_owner)).wait()
  return strategy as DynamicLeverageRatioStrategy
}

async function deploySeniorPoolStrategies(
  deployer: ContractDeployer,
  {config}: DeployOpts
): Promise<[FixedLeverageRatioStrategy, DynamicLeverageRatioStrategy]> {
  const fixedLeverageRatioStrategy = await deployFixedLeverageRatioStrategy(deployer, {config})
  const dynamicLeverageRatioStrategy = await deployDynamicLeverageRatioStrategy(deployer)

  // We initialize the config's SeniorPoolStrategy to use the fixed strategy, not the dynamic strategy.
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPoolStrategy, fixedLeverageRatioStrategy.address, {logger})

  return [fixedLeverageRatioStrategy, dynamicLeverageRatioStrategy]
}

async function deployBorrower(deployer: ContractDeployer, {config}: DeployOpts): Promise<Borrower> {
  const contractName = "Borrower"
  const {gf_deployer} = await deployer.getNamedAccounts()

  assertIsString(gf_deployer)
  const borrower = await deployer.deploy(contractName, {
    from: gf_deployer,
  })
  await updateConfig(config, "address", CONFIG_KEYS.BorrowerImplementation, borrower.address, {logger})

  return borrower as Borrower
}

export {
  baseDeploy,
  deployPoolTokens,
  deployTransferRestrictedVault,
  deployTranchedPool,
  deploySeniorPool,
  deployMigratedTranchedPool,
  deploySeniorPoolStrategies,
  deployBorrower,
  deployClImplementation,
}

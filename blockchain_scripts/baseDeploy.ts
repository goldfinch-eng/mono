import {ethers} from "hardhat"
import fs from "fs"
import BN from "bn.js"
import {CONFIG_KEYS} from "./configKeys"
import {
  USDCDecimals,
  OWNER_ROLE,
  MINTER_ROLE,
  updateConfig,
  getUSDCAddress,
  isTestEnv,
  setInitialConfigVals,
  isMainnetForking,
  assertIsChainId,
  getProtocolOwner,
  getContract,
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
  StakingRewards,
  CommunityRewards,
  MerkleDistributor,
  TestERC20,
} from "../typechain/ethers"
import {Logger, DeployFn, DeployOpts} from "./types"
import {assertIsString, assertNonEmptyString} from "../utils/type"
import {TestCommunityRewards} from "../typechain/ethers/TestCommunityRewards"
import {generateMerkleRoot} from "./merkleDistributor/generateMerkleRoot"
import {isMerkleDistributorInfo} from "./merkleDistributor/types"
import {
  CommunityRewardsInstance,
  MerkleDistributorInstance,
  TestCommunityRewardsInstance,
  TestERC20Instance,
} from "../typechain/truffle"

let logger: Logger

type Deployed<T> = {
  name: string
  contract: T
}

const baseDeploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (isMainnetForking()) {
    return
  }
  const {deployments, getNamedAccounts, getChainId} = hre
  const {deploy, log} = deployments
  logger = log
  logger("Starting deploy...")
  const {gf_deployer} = await getNamedAccounts()
  logger("Will be deploying using the gf_deployer account:", gf_deployer)

  const chainId = await getChainId()
  assertIsChainId(chainId)
  logger("Chain id is:", chainId)
  const config = await deployConfig(deploy)
  await getOrDeployUSDC()
  const fidu = await deployFidu(config)
  await deployPoolTokens(hre, {config})
  await deployTransferRestrictedVault(hre, {config})
  const pool = await deployPool(hre, {config})
  logger("Deploying TranchedPool")
  await deployTranchedPool(hre, {config})
  logger("Granting minter role to Pool")
  await grantMinterRoleToPool(fidu, pool)
  const creditDesk = await deployCreditDesk(deploy, {config})
  await deploySeniorPool(hre, {config, fidu})
  await deployBorrower(hre, {config})
  await deploySeniorPoolStrategies(hre, {config})
  logger("Deploying GoldfinchFactory")
  await deployGoldfinchFactory(deploy, {config})
  await deployClImplementation(hre, {config})

  await deployGFI(hre, {config})
  await deployLPStakingRewards(hre, {config})
  const communityRewards = await deployCommunityRewards(hre, {config})
  await deployMerkleDistributor(hre, {communityRewards})

  logger("Granting ownership of Pool to CreditDesk")
  await grantOwnershipOfPoolToCreditDesk(pool, creditDesk.address)

  // Internal functions.

  async function deployConfig(deploy: DeployFn): Promise<GoldfinchConfig> {
    let contractName = "GoldfinchConfig"

    if (isTestEnv()) {
      contractName = "TestGoldfinchConfig"
    }

    assertIsString(gf_deployer)
    let deployResult = await deploy(contractName, {
      from: gf_deployer,
      gasLimit: 4000000,
    })
    logger("Config was deployed to:", deployResult.address)
    let config = (await ethers.getContractAt(deployResult.abi, deployResult.address)) as GoldfinchConfig
    if (deployResult.newlyDeployed) {
      logger("Config newly deployed, initializing...")
      const protocol_owner = await getProtocolOwner()
      assertIsString(protocol_owner)
      await (await config.initialize(protocol_owner)).wait()
    }

    await setInitialConfigVals(config, logger)

    return config
  }

  async function getOrDeployUSDC() {
    assertIsChainId(chainId)
    let usdcAddress = getUSDCAddress(chainId)
    const protocolOwner = await getProtocolOwner()
    if (!usdcAddress) {
      logger("We don't have a USDC address for this network, so deploying a fake USDC")
      const initialAmount = String(new BN("100000000").mul(USDCDecimals))
      const decimalPlaces = String(new BN(6))
      assertIsString(gf_deployer)
      const fakeUSDC = await deploy("TestERC20", {
        from: gf_deployer,
        gasLimit: 4000000,
        args: [initialAmount, decimalPlaces],
      })
      logger("Deployed the contract to:", fakeUSDC.address)
      usdcAddress = fakeUSDC.address
      ;(
        await getContract<TestERC20, TestERC20Instance>("TestERC20", TRUFFLE_CONTRACT_PROVIDER, {from: gf_deployer})
      ).transfer(protocolOwner, String(new BN(10000000).mul(USDCDecimals)))
    }
    await updateConfig(config, "address", CONFIG_KEYS.USDC, usdcAddress, logger)
    return usdcAddress
  }

  async function deployGoldfinchFactory(deploy: DeployFn, {config}: DeployOpts): Promise<GoldfinchFactory> {
    logger("Deploying goldfinch factory")
    assertIsString(gf_deployer)
    const accountant = await deploy("Accountant", {from: gf_deployer, gasLimit: 4000000, args: []})
    const protocol_owner = await getProtocolOwner()

    let goldfinchFactoryDeployResult = await deploy("GoldfinchFactory", {
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
      gasLimit: 4000000,
      libraries: {
        ["Accountant"]: accountant.address,
      },
    })
    logger("GoldfinchFactory was deployed to:", goldfinchFactoryDeployResult.address)

    const goldfinchFactory = await ethers.getContractAt("GoldfinchFactory", goldfinchFactoryDeployResult.address)
    let goldfinchFactoryAddress = goldfinchFactory.address

    await updateConfig(config, "address", CONFIG_KEYS.GoldfinchFactory, goldfinchFactoryAddress, {logger})
    return goldfinchFactory as GoldfinchFactory
  }

  async function deployCreditDesk(deploy: DeployFn, {config}: DeployOpts) {
    const protocol_owner = await getProtocolOwner()
    assertIsString(gf_deployer)
    const accountant = await deploy("Accountant", {from: gf_deployer, gasLimit: 4000000, args: []})
    logger("Accountant was deployed to:", accountant.address)

    let contractName = "CreditDesk"

    if (isTestEnv()) {
      contractName = "TestCreditDesk"
    }

    logger("Deploying CreditDesk")
    assertIsString(gf_deployer)
    let creditDeskDeployResult = await deploy(contractName, {
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
      gasLimit: 4000000,
      libraries: {["Accountant"]: accountant.address},
    })
    logger("Credit Desk was deployed to:", creditDeskDeployResult.address)
    let creditDeskAddress = creditDeskDeployResult.address
    await updateConfig(config, "address", CONFIG_KEYS.CreditDesk, creditDeskAddress, {logger})
    return await ethers.getContractAt(creditDeskDeployResult.abi, creditDeskDeployResult.address)
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

  async function deployFidu(config: GoldfinchConfig): Promise<Fidu> {
    logger("About to deploy Fidu...")
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const fiduDeployResult = await deploy("Fidu", {
      from: gf_deployer,
      gasLimit: 4000000,
      proxy: {
        execute: {
          init: {
            methodName: "__initialize__",
            args: [protocol_owner, "Fidu", "FIDU", config.address],
          },
        },
      },
    })
    const fidu = (await ethers.getContractAt("Fidu", fiduDeployResult.address)) as Fidu
    let fiduAddress = fidu.address

    await updateConfig(config, "address", CONFIG_KEYS.Fidu, fiduAddress, {logger})
    logger("Deployed Fidu to address:", fidu.address)
    return fidu
  }

  async function deployGFI(hre: HardhatRuntimeEnvironment, {config}: {config: GoldfinchConfig}): Promise<GFI> {
    logger("About to deploy GFI...")
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const deployResult = await deploy("GFI", {
      from: gf_deployer,
      gasLimit: 4000000,
      proxy: {
        execute: {
          init: {
            methodName: "__initialize__",
            args: [protocol_owner, "GFI", "GFI", config.address],
          },
        },
      },
    })
    const gfi = (await ethers.getContractAt("GFI", deployResult.address)) as GFI

    await updateConfig(config, "address", CONFIG_KEYS.GFI, gfi.address, {logger})
    logger("Deployed GFI to address:", gfi.address)
    return gfi
  }

  async function deployLPStakingRewards(
    hre: HardhatRuntimeEnvironment,
    {config}: {config: GoldfinchConfig}
  ): Promise<StakingRewards> {
    logger("About to deploy LPStakingRewards...")
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const deployResult = await deploy("StakingRewards", {
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
    const contract = (await ethers.getContractAt("StakingRewards", deployResult.address)) as StakingRewards

    // await updateConfig(config, "address", CONFIG_KEYS., contract.address, {logger})
    logger("Deployed LPStakingRewards to address:", contract.address)
    return contract
  }

  async function deployCommunityRewards(
    hre: HardhatRuntimeEnvironment,
    {config}: {config: GoldfinchConfig}
  ): Promise<Deployed<CommunityRewardsInstance | TestCommunityRewardsInstance>> {
    const contractName = isTestEnv() ? "TestCommunityRewards" : "CommunityRewards"
    logger(`About to deploy ${contractName}...`)
    assertIsString(gf_deployer)
    const protocol_owner = await getProtocolOwner()
    const deployResult = await deploy(contractName, {
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
    const contract = await getContract<
      CommunityRewards | TestCommunityRewards,
      CommunityRewardsInstance | TestCommunityRewardsInstance
    >(contractName, TRUFFLE_CONTRACT_PROVIDER, {at: deployResult.address})

    // await updateConfig(config, "address", CONFIG_KEYS., contract.address, {logger})
    logger(`Deployed ${contractName} to address:`, contract.address)
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
    hre: HardhatRuntimeEnvironment,
    {
      communityRewards,
    }: {
      communityRewards: Deployed<CommunityRewardsInstance | TestCommunityRewardsInstance>
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
    const deployResult = await deploy(contractName, {
      from: gf_deployer,
      gasLimit: 4000000,
      args: [communityRewards.contract.address, merkleRoot],
    })
    const contract = await getContract<MerkleDistributor, MerkleDistributorInstance>(
      contractName,
      TRUFFLE_CONTRACT_PROVIDER,
      {at: deployResult.address}
    )

    logger(`Deployed ${contractName} to address: ${contract.address}`)

    const deployed: Deployed<MerkleDistributorInstance> = {
      name: contractName,
      contract,
    }
    await grantDistributorRoleToMerkleDistributor(communityRewards, deployed)

    return deployed
  }
}

async function grantDistributorRoleToMerkleDistributor(
  communityRewards: Deployed<CommunityRewardsInstance | TestCommunityRewardsInstance>,
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
    throw new Error(`Failed to grant DISTRIBUTOR role on ${communityRewards.name} to ${merkleDistributor.name}.`)
  }
}

async function grantMinterRoleToPool(fidu: Fidu, pool: any) {
  if (!(await fidu.hasRole(MINTER_ROLE, pool.address))) {
    await fidu.grantRole(MINTER_ROLE, pool.address)
  }
}

async function deployTranchedPool(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()

  logger("About to deploy TranchedPool...")
  let contractName = "TranchedPool"

  if (isTestEnv()) {
    contractName = "TestTranchedPool"
  }

  assertIsString(gf_deployer)
  const tranchedPoolImpl = await deploy(contractName, {
    from: gf_deployer,
  })
  await updateConfig(config, "address", CONFIG_KEYS.TranchedPoolImplementation, tranchedPoolImpl.address, {logger})
  logger("Updated TranchedPool config address to:", tranchedPoolImpl.address)
  return tranchedPoolImpl
}

async function deployClImplementation(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const {gf_deployer} = await getNamedAccounts()

  assertIsString(gf_deployer)
  const accountant = await deploy("Accountant", {from: gf_deployer, gasLimit: 4000000, args: []})
  // Deploy the credit line as well so we generate the ABI
  assertIsString(gf_deployer)
  const clDeployResult = await deploy("CreditLine", {
    from: gf_deployer,
    gasLimit: 4000000,
    libraries: {["Accountant"]: accountant.address},
  })

  await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, clDeployResult.address)
}

async function deployMigratedTranchedPool(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()

  logger("About to deploy MigratedTranchedPool...")
  let contractName = "MigratedTranchedPool"

  assertIsString(gf_deployer)
  const migratedTranchedPoolImpl = await deploy(contractName, {from: gf_deployer})
  await updateConfig(
    config,
    "address",
    CONFIG_KEYS.MigratedTranchedPoolImplementation,
    migratedTranchedPoolImpl.address,
    {logger}
  )
  logger("Updated MigratedTranchedPool config address to:", migratedTranchedPoolImpl.address)
  return migratedTranchedPoolImpl
}

async function deployTransferRestrictedVault(
  hre: HardhatRuntimeEnvironment,
  {config}: DeployOpts
): Promise<TransferRestrictedVault> {
  const {deployments, getNamedAccounts, getChainId} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const chainId = await getChainId()
  assertIsChainId(chainId)

  let contractName = "TransferRestrictedVault"

  logger(`About to deploy ${contractName}...`)
  const deployResult = await deploy(contractName, {
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
  const contract = (await ethers.getContractAt(contractName, deployResult.address)) as TransferRestrictedVault
  return contract
}

async function deployPoolTokens(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  const {deployments, getNamedAccounts, getChainId} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const chainId = await getChainId()
  assertIsChainId(chainId)

  let contractName = "PoolTokens"

  if (isTestEnv()) {
    contractName = "TestPoolTokens"
  }

  logger("About to deploy Pool Tokens...")
  const poolTokensDeployResult = await deploy(contractName, {
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
  logger("Initialized Pool Tokens...")
  await updateConfig(config, "address", CONFIG_KEYS.PoolTokens, poolTokensDeployResult.address, {logger})
  const poolTokens = await ethers.getContractAt(contractName, poolTokensDeployResult.address)
  logger("Updated PoolTokens config address to:", poolTokens.address)
  return poolTokens
}

async function deployPool(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  let contractName = "Pool"
  if (isTestEnv()) {
    contractName = "TestPool"
  }
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  assertIsString(gf_deployer)
  let poolDeployResult = await deploy(contractName, {
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
  logger("Pool was deployed to:", poolDeployResult.address)
  const pool = await ethers.getContractAt(contractName, poolDeployResult.address)
  let poolAddress = pool.address
  await updateConfig(config, "address", CONFIG_KEYS.Pool, poolAddress, {logger})

  return pool
}

async function deploySeniorPool(hre: HardhatRuntimeEnvironment, {config, fidu}: DeployOpts): Promise<SeniorPool> {
  let contractName = "SeniorPool"
  if (isTestEnv()) {
    contractName = "TestSeniorPool"
  }
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const accountant = await deploy("Accountant", {from: gf_deployer, gasLimit: 4000000, args: []})
  logger("Accountant was deployed to:", accountant.address)
  logger(`Deploying ...${contractName}`)
  log("config address:", config.address)
  let deployResult = await deploy(contractName, {
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
  logger(`${contractName} was deployed to:`, deployResult.address)
  const seniorPool = (await ethers.getContractAt(contractName, deployResult.address)) as SeniorPool
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPool, seniorPool.address, {logger})
  await (await config.addToGoList(seniorPool.address)).wait()
  if (fidu) {
    logger(`Granting minter role to ${contractName}`)
    await grantMinterRoleToPool(fidu, seniorPool)
  }
  return seniorPool
}

async function deployFixedLeverageRatioStrategy(
  hre: HardhatRuntimeEnvironment,
  {config}: DeployOpts
): Promise<FixedLeverageRatioStrategy> {
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "FixedLeverageRatioStrategy"

  assertIsString(gf_deployer)
  let deployResult = await deploy(contractName, {
    from: gf_deployer,
  })
  logger(`${contractName} was deployed to:`, deployResult.address)
  const strategy = (await ethers.getContractAt(contractName, deployResult.address)) as FixedLeverageRatioStrategy
  if (deployResult.newlyDeployed) {
    logger(`${contractName} newly deployed, initializing...`)
    assertIsString(protocol_owner)
    await (await strategy.initialize(protocol_owner, config.address)).wait()
  }

  return strategy
}

async function deployDynamicLeverageRatioStrategy(
  hre: HardhatRuntimeEnvironment
): Promise<DynamicLeverageRatioStrategy> {
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "DynamicLeverageRatioStrategy"

  assertIsString(gf_deployer)
  let deployResult = await deploy(contractName, {
    from: gf_deployer,
  })
  logger(`${contractName} was deployed to:`, deployResult.address)
  const strategy = (await ethers.getContractAt(contractName, deployResult.address)) as DynamicLeverageRatioStrategy
  if (deployResult.newlyDeployed) {
    logger(`${contractName} newly deployed, initializing...`)
    assertIsString(protocol_owner)
    await (await strategy.initialize(protocol_owner)).wait()
  }

  return strategy
}

async function deploySeniorPoolStrategies(
  hre: HardhatRuntimeEnvironment,
  {config}: DeployOpts
): Promise<[FixedLeverageRatioStrategy, DynamicLeverageRatioStrategy]> {
  const {deployments} = hre
  const {log} = deployments
  const logger = log

  const fixedLeverageRatioStrategy = await deployFixedLeverageRatioStrategy(hre, {config})
  const dynamicLeverageRatioStrategy = await deployDynamicLeverageRatioStrategy(hre)

  // We initialize the config's SeniorPoolStrategy to use the fixed strategy, not the dynamic strategy.
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPoolStrategy, fixedLeverageRatioStrategy.address, {logger})

  return [fixedLeverageRatioStrategy, dynamicLeverageRatioStrategy]
}

async function deployBorrower(hre: HardhatRuntimeEnvironment, {config}: DeployOpts): Promise<Borrower> {
  let contractName = "Borrower"
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {gf_deployer} = await getNamedAccounts()

  assertIsString(gf_deployer)
  let deployResult = await deploy(contractName, {
    from: gf_deployer,
  })
  logger("Borrower implementation was deployed to:", deployResult.address)
  const borrower = (await ethers.getContractAt(contractName, deployResult.address)) as Borrower
  await updateConfig(config, "address", CONFIG_KEYS.BorrowerImplementation, borrower.address, {logger})

  return borrower
}

module.exports = {
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

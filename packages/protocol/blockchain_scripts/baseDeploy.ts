import {ethers} from "hardhat"
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
} from "./deployHelpers"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {DeployFunction} from "hardhat-deploy/types"
import {
  GoldfinchConfig,
  GoldfinchFactory,
  Fidu,
  TransferRestrictedVault,
  Borrower,
  SeniorPool,
  FixedLeverageRatioStrategy,
} from "../typechain/ethers"
import {Logger, DeployFn, DeployOpts} from "./types"
import {assertIsString} from "@goldfinch-eng/utils"

let logger: Logger

const baseDeploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (isMainnetForking()) {
    return
  }
  const {deployments, getNamedAccounts, getChainId} = hre
  const {deploy} = deployments
  logger = console.log
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
  logger("Granting minter role to SeniorPool")
  await deploySeniorPoolStrategy(hre, {config})
  logger("Deploying GoldfinchFactory")
  await deployGoldfinchFactory(deploy, {config})
  await deployClImplementation(hre, {config})

  logger("Granting ownership of Pool to CreditDesk")
  await grantOwnershipOfPoolToCreditDesk(pool, creditDesk.address)

  // Internal functions.

  async function deployConfig(deploy: DeployFn): Promise<GoldfinchConfig> {
    let contractName = "GoldfinchConfig"

    if (isTestEnv()) {
      contractName = "TestGoldfinchConfig"
    }

    assertIsString(gf_deployer)
    const deployResult = await deploy(contractName, {
      from: gf_deployer,
    })
    logger("Config was deployed to:", deployResult.address)
    const config = (await ethers.getContractAt(deployResult.abi, deployResult.address)) as GoldfinchConfig
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
        args: [initialAmount, decimalPlaces],
      })
      logger("Deployed the contract to:", fakeUSDC.address)
      usdcAddress = fakeUSDC.address
      ;(await getContract("TestERC20", {from: gf_deployer})).transfer(
        protocolOwner,
        String(new BN(10000000).mul(USDCDecimals))
      )
    }
    await updateConfig(config, "address", CONFIG_KEYS.USDC, usdcAddress, logger)
    return usdcAddress
  }

  async function deployGoldfinchFactory(deploy: DeployFn, {config}: DeployOpts): Promise<GoldfinchFactory> {
    logger("Deploying goldfinch factory")
    assertIsString(gf_deployer)
    const accountant = await deploy("Accountant", {from: gf_deployer, args: []})
    const protocol_owner = await getProtocolOwner()

    const goldfinchFactoryDeployResult = await deploy("GoldfinchFactory", {
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
    logger("GoldfinchFactory was deployed to:", goldfinchFactoryDeployResult.address)

    const goldfinchFactory = await ethers.getContractAt("GoldfinchFactory", goldfinchFactoryDeployResult.address)
    const goldfinchFactoryAddress = goldfinchFactory.address

    await updateConfig(config, "address", CONFIG_KEYS.GoldfinchFactory, goldfinchFactoryAddress, {logger})
    return goldfinchFactory as GoldfinchFactory
  }

  async function deployCreditDesk(deploy: DeployFn, {config}: DeployOpts) {
    const protocol_owner = await getProtocolOwner()
    assertIsString(gf_deployer)
    const accountant = await deploy("Accountant", {from: gf_deployer, args: []})
    logger("Accountant was deployed to:", accountant.address)

    let contractName = "CreditDesk"

    if (isTestEnv()) {
      contractName = "TestCreditDesk"
    }

    logger("Deploying CreditDesk")
    assertIsString(gf_deployer)
    const creditDeskDeployResult = await deploy(contractName, {
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
    logger("Credit Desk was deployed to:", creditDeskDeployResult.address)
    const creditDeskAddress = creditDeskDeployResult.address
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
    const fiduAddress = fidu.address

    await updateConfig(config, "address", CONFIG_KEYS.Fidu, fiduAddress, {logger})
    logger("Deployed Fidu to address:", fidu.address)
    return fidu
  }
}

async function grantMinterRoleToPool(fidu: Fidu, pool: any) {
  if (!(await fidu.hasRole(MINTER_ROLE, pool.address))) {
    await fidu.grantRole(MINTER_ROLE, pool.address)
  }
}

async function deployTranchedPool(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const logger = console.log
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
  logger("Deployed TranchedPool...")
  logger("Updating config...")
  await updateConfig(config, "address", CONFIG_KEYS.TranchedPoolImplementation, tranchedPoolImpl.address, {logger})
  logger("Updated TranchedPool config address to:", tranchedPoolImpl.address)
  return tranchedPoolImpl
}

async function deployClImplementation(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const {gf_deployer} = await getNamedAccounts()

  assertIsString(gf_deployer)
  console.log("Deploying Accountant")
  const accountant = await deploy("Accountant", {from: gf_deployer, args: []})
  console.log("Deployed...")
  // Deploy the credit line as well so we generate the ABI
  assertIsString(gf_deployer)
  console.log("Deploying CreditLine...")
  const clDeployResult = await deploy("CreditLine", {
    from: gf_deployer,
    libraries: {["Accountant"]: accountant.address},
  })
  console.log("Deployed...")
  console.log("Updating config...")
  await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, clDeployResult.address)
}

async function deployMigratedTranchedPool(hre: HardhatRuntimeEnvironment, {config}: DeployOpts) {
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const logger = console.log
  const {gf_deployer} = await getNamedAccounts()

  logger("About to deploy MigratedTranchedPool...")
  const contractName = "MigratedTranchedPool"

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
  const {deploy} = deployments
  const logger = console.log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const chainId = await getChainId()
  assertIsChainId(chainId)

  const contractName = "TransferRestrictedVault"

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
  const {deploy} = deployments
  const logger = console.log
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
  logger("And updating config...")
  await updateConfig(config, "address", CONFIG_KEYS.PoolTokens, poolTokensDeployResult.address, {logger})
  logger("Config updated...")
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
  const {deploy} = deployments
  const logger = console.log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  assertIsString(gf_deployer)
  const poolDeployResult = await deploy(contractName, {
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
  const poolAddress = pool.address
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
  const logger = console.log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const accountant = await deploy("Accountant", {from: gf_deployer, args: []})
  logger("Accountant was deployed to:", accountant.address)
  logger(`Deploying ...${contractName}`)
  log("config address:", config.address)
  const deployResult = await deploy(contractName, {
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
  logger("SeniorPool was deployed to:", deployResult.address)
  const fund = (await ethers.getContractAt(contractName, deployResult.address)) as SeniorPool
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPool, fund.address, {logger})
  await (await config.addToGoList(fund.address)).wait()
  if (fidu) {
    await grantMinterRoleToPool(fidu, fund)
  }
  return fund
}

async function deploySeniorPoolStrategy(
  hre: HardhatRuntimeEnvironment,
  {config}: DeployOpts
): Promise<FixedLeverageRatioStrategy> {
  const contractName = "FixedLeverageRatioStrategy"
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const logger = console.log
  const {gf_deployer} = await getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  assertIsString(gf_deployer)
  logger("Trying to deploy", contractName)
  const deployResult = await deploy(contractName, {
    from: gf_deployer,
  })
  logger(`${contractName} was deployed to:`, deployResult.address)
  const strategy = (await ethers.getContractAt(contractName, deployResult.address)) as FixedLeverageRatioStrategy
  if (deployResult.newlyDeployed) {
    logger(`${contractName} newly deployed, initializing...`)
    assertIsString(protocol_owner)
    await (await strategy.initialize(protocol_owner, config.address)).wait()
  }
  logger("Updating the config with address", strategy.address)
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPoolStrategy, strategy.address, {logger})
  logger("Updated config")

  return strategy
}

async function deployBorrower(hre: HardhatRuntimeEnvironment, {config}: DeployOpts): Promise<Borrower> {
  const contractName = "Borrower"
  const {deployments, getNamedAccounts} = hre
  const {deploy} = deployments
  const logger = console.log
  const {gf_deployer} = await getNamedAccounts()

  assertIsString(gf_deployer)
  const deployResult = await deploy(contractName, {
    from: gf_deployer,
  })
  logger("Borrower implementation was deployed to:", deployResult.address)
  const borrower = (await ethers.getContractAt(contractName, deployResult.address)) as Borrower
  await updateConfig(config, "address", CONFIG_KEYS.BorrowerImplementation, borrower.address, {logger})

  return borrower
}

export {
  baseDeploy,
  deployPoolTokens,
  deployTransferRestrictedVault,
  deployTranchedPool,
  deploySeniorPool,
  deployMigratedTranchedPool,
  deploySeniorPoolStrategy,
  deployBorrower,
  deployClImplementation,
}

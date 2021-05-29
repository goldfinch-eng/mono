/* globals ethers */
const BN = require("bn.js")
const {CONFIG_KEYS} = require("./configKeys")
const {
  USDCDecimals,
  OWNER_ROLE,
  MINTER_ROLE,
  updateConfig,
  getUSDCAddress,
  isTestEnv,
  setInitialConfigVals,
  SAFE_CONFIG,
  isMainnetForking,
} = require("./deployHelpers.js")
let logger

async function baseDeploy(hre) {
  if (isMainnetForking()) {
    return
  }
  const {deployments, getNamedAccounts, getChainId, ethers} = hre
  const {deploy, log} = deployments
  logger = log
  logger("Starting deploy...")
  const {protocol_owner, proxy_owner} = await getNamedAccounts()
  logger("Will be deploying using the protocol_owner account:", protocol_owner)

  const chainID = await getChainId()
  logger("Chain ID is:", chainID)
  const config = await deployConfig(deploy)
  await getOrDeployUSDC()
  const fidu = await deployFidu(config)
  await deployPoolTokens(hre, {config})
  const pool = await deployPool(hre, {config})
  logger("Deploying TranchedPool")
  await deployTranchedPool(hre, {config})
  logger("Granting minter role to Pool")
  await grantMinterRoleToPool(fidu, pool)
  const creditDesk = await deployCreditDesk(deploy, {config})
  await deploySeniorFund(hre, {config, fidu})
  await deployBorrower(hre, {config})
  logger("Granting minter role to SeniorFund")
  await deploySeniorFundStrategy(hre, {config})
  logger("Deploying CreditLineFactory")
  await deployCreditLineFactory(deploy, {config})
  await deployCreditLineFactoryV2(hre, {config})

  logger("Granting ownership of Pool to CreditDesk")
  await grantOwnershipOfPoolToCreditDesk(pool, creditDesk.address)

  // Internal functions.

  async function deployConfig(deploy) {
    let contractName = "GoldfinchConfig"

    if (isTestEnv()) {
      contractName = "TestGoldfinchConfig"
    }

    let deployResult = await deploy(contractName, {
      from: proxy_owner,
      gas: 4000000,
    })
    logger("Config was deployed to:", deployResult.address)
    let config = await ethers.getContractAt(deployResult.abi, deployResult.address)
    if (deployResult.newlyDeployed) {
      logger("Config newly deployed, initializing...")
      await (await config.initialize(protocol_owner)).wait()
    }

    await setInitialConfigVals(config, logger)

    return config
  }

  async function getOrDeployUSDC() {
    let usdcAddress = getUSDCAddress(chainID)
    if (!usdcAddress) {
      logger("We don't have a USDC address for this network, so deploying a fake USDC")
      const initialAmount = String(new BN("1000000").mul(USDCDecimals))
      const decimalPlaces = String(new BN(6))
      const fakeUSDC = await deploy("TestERC20", {
        from: protocol_owner,
        gas: 4000000,
        args: [initialAmount, decimalPlaces],
      })
      logger("Deployed the contract to:", fakeUSDC.address)
      usdcAddress = fakeUSDC.address
    }
    await updateConfig(config, "address", CONFIG_KEYS.USDC, usdcAddress, logger)
    return usdcAddress
  }

  async function deployCreditLineFactory(deploy, {config}) {
    logger("Deploying credit line factory")
    const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})
    let clFactoryDeployResult = await deploy("CreditLineFactory", {
      from: proxy_owner,
      proxy: {owner: proxy_owner, methodName: "initialize"},
      gas: 4000000,
      args: [protocol_owner, config.address],
      libraries: {
        ["Accountant"]: accountant.address,
      },
    })
    logger("CreditLineFactory was deployed to:", clFactoryDeployResult.address)

    const creditLineFactory = await ethers.getContractAt("CreditLineFactory", clFactoryDeployResult.address)
    let creditLineFactoryAddress = creditLineFactory.address

    await updateConfig(config, "address", CONFIG_KEYS.CreditLineFactory, creditLineFactoryAddress, {logger})
    return creditLineFactory
  }

  async function deployCreditDesk(deploy, {config}) {
    const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})
    logger("Accountant was deployed to:", accountant.address)

    let contractName = "CreditDesk"

    if (isTestEnv()) {
      contractName = "TestCreditDesk"
    }

    logger("Deploying CreditDesk")
    let creditDeskDeployResult = await deploy(contractName, {
      from: proxy_owner,
      proxy: {owner: proxy_owner, methodName: "initialize"},
      gas: 4000000,
      args: [protocol_owner, config.address],
      libraries: {["Accountant"]: accountant.address},
    })
    logger("Credit Desk was deployed to:", creditDeskDeployResult.address)
    let creditDeskAddress = creditDeskDeployResult.address
    await updateConfig(config, "address", CONFIG_KEYS.CreditDesk, creditDeskAddress, {logger})
    return await ethers.getContractAt(creditDeskDeployResult.abi, creditDeskDeployResult.address)
  }

  async function grantOwnershipOfPoolToCreditDesk(pool, creditDeskAddress) {
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

  async function deployFidu(config) {
    logger("About to deploy Fidu...")
    const fiduDeployResult = await deploy("Fidu", {
      from: proxy_owner,
      gas: 4000000,
      proxy: {
        methodName: "__initialize__",
      },
      args: [protocol_owner, "Fidu", "FIDU", config.address],
    })
    const fidu = await ethers.getContractAt("Fidu", fiduDeployResult.address)
    let fiduAddress = fidu.address

    await updateConfig(config, "address", CONFIG_KEYS.Fidu, fiduAddress, {logger})
    logger("Deployed Fidu to address:", fidu.address)
    return fidu
  }
}

async function grantMinterRoleToPool(fidu, pool) {
  if (!(await fidu.hasRole(MINTER_ROLE, pool.address))) {
    await fidu.grantRole(MINTER_ROLE, pool.address)
  }
}

async function deployTranchedPool(hre, {config}) {
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {proxy_owner} = await getNamedAccounts()

  logger("About to deploy TranchedPool...")
  let contractName = "TranchedPool"

  if (isTestEnv()) {
    contractName = "TestTranchedPool"
  }

  const tranchedPoolImpl = await deploy(contractName, {
    from: proxy_owner,
  })
  await updateConfig(config, "address", CONFIG_KEYS.TranchedPoolImplementation, tranchedPoolImpl.address, {logger})
  logger("Updated TranchedPool config address to:", tranchedPoolImpl.address)
  return tranchedPoolImpl
}

async function deployMigratedTranchedPool(hre, {config}) {
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {protocol_owner, proxy_owner} = await getNamedAccounts()

  const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})

  logger("About to deploy MigratedTranchedPool...")
  let contractName = "MigratedTranchedPool"

  const migratedTranchedPoolImpl = await deploy(contractName, {
    from: proxy_owner,
    libraries: {["Accountant"]: accountant.address},
  })
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

async function deployPoolTokens(hre, {config}) {
  const {deployments, getNamedAccounts, getChainId} = hre
  const {deploy, log} = deployments
  const logger = log
  const {protocol_owner, proxy_owner} = await getNamedAccounts()
  const chainID = await getChainId()

  let contractName = "PoolTokens"

  if (isTestEnv()) {
    contractName = "TestPoolTokens"
  }

  logger("About to deploy Pool Tokens...")
  const poolTokensDeployResult = await deploy(contractName, {
    from: proxy_owner,
    proxy: {
      methodName: "__initialize__",
    },
    args: [SAFE_CONFIG[chainID] || protocol_owner, config.address],
  })
  logger("Initialized Pool Tokens...")
  await updateConfig(config, "address", CONFIG_KEYS.PoolTokens, poolTokensDeployResult.address, {logger})
  const poolTokens = await ethers.getContractAt(contractName, poolTokensDeployResult.address)
  logger("Updated PoolTokens config address to:", poolTokens.address)
  return poolTokens
}

async function deployPool(hre, {config}) {
  let contractName = "Pool"
  if (isTestEnv()) {
    contractName = "TestPool"
  }
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {protocol_owner, proxy_owner} = await getNamedAccounts()

  let poolDeployResult = await deploy(contractName, {
    from: proxy_owner,
    proxy: {methodName: "initialize"},
    args: [protocol_owner, config.address],
  })
  logger("Pool was deployed to:", poolDeployResult.address)
  const pool = await ethers.getContractAt(contractName, poolDeployResult.address)
  let poolAddress = pool.address
  await updateConfig(config, "address", CONFIG_KEYS.Pool, poolAddress, {logger})

  return pool
}

async function deploySeniorFund(hre, {config, fidu}) {
  let contractName = "SeniorFund"
  if (isTestEnv()) {
    contractName = "TestSeniorFund"
  }
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {protocol_owner, proxy_owner} = await getNamedAccounts()

  const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})
  logger("Accountant was deployed to:", accountant.address)

  let deployResult = await deploy(contractName, {
    from: proxy_owner,
    proxy: {methodName: "initialize"},
    args: [protocol_owner, config.address],
    libraries: {["Accountant"]: accountant.address},
  })
  const fund = await ethers.getContractAt(contractName, deployResult.address)
  await updateConfig(config, "address", CONFIG_KEYS.SeniorFund, fund.address, {logger})
  if (fidu) {
    await grantMinterRoleToPool(fidu, fund)
  }
  return fund
}

async function deploySeniorFundStrategy(hre, {config}) {
  let contractName = "FixedLeverageRatioStrategy"
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {proxy_owner} = await getNamedAccounts()

  let deployResult = await deploy(contractName, {
    from: proxy_owner,
    args: [new BN(4).toString()],
  })
  logger("FixedLeverageRatioStrategy was deployed to:", deployResult.address)
  const strategy = await ethers.getContractAt(contractName, deployResult.address)
  await updateConfig(config, "address", CONFIG_KEYS.SeniorFundStrategy, strategy.address, {logger})

  return strategy
}

async function deployBorrower(hre, {config}) {
  let contractName = "Borrower"
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {proxy_owner} = await getNamedAccounts()

  let deployResult = await deploy(contractName, {
    from: proxy_owner,
  })
  logger("Borrower implementation was deployed to:", deployResult.address)
  const borrower = await ethers.getContractAt(contractName, deployResult.address)
  await updateConfig(config, "address", CONFIG_KEYS.BorrowerImplementation, borrower.address, {logger})

  return borrower
}

async function deployCreditLineFactoryV2(hre, {config}) {
  const {deployments, getNamedAccounts} = hre
  const {log, deploy} = deployments
  const {proxy_owner, protocol_owner} = await getNamedAccounts()
  const logger = log
  logger("Deploying credit line factory")

  const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})
  let clFactoryDeployResult = await deploy("CreditLineFactoryV2", {
    from: proxy_owner,
    proxy: {owner: proxy_owner, methodName: "initialize"},
    gas: 4000000,
    args: [protocol_owner, config.address],
    libraries: {
      ["Accountant"]: accountant.address,
    },
  })
  logger("CreditLineFactoryV2 was deployed to:", clFactoryDeployResult.address)

  // Deploy the credit line as well so we generate the ABI
  const clDeployResult = await deploy("CreditLine", {
    from: proxy_owner,
    gas: 4000000,
    libraries: {["Accountant"]: accountant.address},
  })

  const creditLineFactory = await ethers.getContractAt("CreditLineFactoryV2", clFactoryDeployResult.address)
  let creditLineFactoryAddress = creditLineFactory.address

  await updateConfig(config, "address", CONFIG_KEYS.CreditLineFactoryV2, creditLineFactoryAddress, {logger})
  await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, clDeployResult.address, {logger})
  return creditLineFactory
}

module.exports = {
  baseDeploy,
  deployPoolTokens,
  deployTranchedPool,
  deploySeniorFund,
  deployMigratedTranchedPool,
  deploySeniorFundStrategy,
  deployCreditLineFactoryV2,
  deployBorrower,
}

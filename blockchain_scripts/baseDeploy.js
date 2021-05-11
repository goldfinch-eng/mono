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
  const deployHelpers = await deployDeployHelpers()
  await getOrDeployUSDC()
  const fidu = await deployFidu(config)
  const seniorFundFidu = await deploySeniorFundFidu(config)
  await deployPoolTokens({config, deployHelpers})
  const pool = await deployPool(hre, {config})
  logger("Deploying TranchedPool")
  await deployTranchedPool(config)
  logger("Granting minter role to Pool")
  await grantMinterRoleToPool(fidu, pool)
  const seniorFund = await deploySeniorFund(hre, {config})
  logger("Granting minter role to SeniorFund")
  await grantMinterRoleToPool(seniorFundFidu, seniorFund)
  await deploySeniorFundStrategy(hre, {config})
  logger("Deploying CreditLineFactory")
  await deployCreditLineFactory(deploy, {config, deployHelpers})
  const creditDesk = await deployCreditDesk(deploy, {config})

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

  async function grantMinterRoleToPool(fidu, pool) {
    if (!(await fidu.hasRole(MINTER_ROLE, pool.address))) {
      await fidu.grantRole(MINTER_ROLE, pool.address)
    }
  }

  async function deployDeployHelpers() {
    const deployHelpers = await deploy("DeployHelpers", {from: protocol_owner, args: []})
    logger("Deploy Helpers was deployed to:", deployHelpers.address)
    return deployHelpers
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

  async function deployCreditLineFactory(deploy, {config, deployHelpers}) {
    if (!deployHelpers) {
      deployHelpers = await deploy("DeployHelpers", {from: protocol_owner, args: []})
      logger("Deploy Helpers was deployed to:", deployHelpers.address)
    }
    logger("Deploying credit line factory")
    const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})
    let clFactoryDeployResult = await deploy("CreditLineFactory", {
      from: proxy_owner,
      proxy: {owner: proxy_owner, methodName: "initialize"},
      gas: 4000000,
      args: [protocol_owner, config.address],
      libraries: {
        ["DeployHelpers"]: deployHelpers.address,
        ["Accountant"]: accountant.address,
      },
    })
    logger("CreditLineFactory was deployed to:", clFactoryDeployResult.address)

    // Deploy the credit line as well so we generate the ABI
    await deploy("CreditLine", {from: proxy_owner, gas: 4000000, libraries: {["Accountant"]: accountant.address}})

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

  async function deployPoolTokens({config, deployHelpers}) {
    if (!deployHelpers) {
      deployHelpers = await deploy("DeployHelpers", {from: protocol_owner, args: []})
      logger("Deploy Helpers was deployed to:", deployHelpers.address)
    }

    let contractName = "PoolTokens"

    if (isTestEnv()) {
      contractName = "TestPoolTokens"
    }

    logger("About to deploy Pool Tokens...")
    const poolTokens = await deploy(contractName, {
      from: proxy_owner,
      proxy: {
        methodName: "__initialize__",
      },
      args: [SAFE_CONFIG[chainID] || protocol_owner, config.address],
      libraries: {["DeployHelpers"]: deployHelpers.address},
    })
    logger("Initialized Pool Tokens...")
    await updateConfig(config, "address", CONFIG_KEYS.PoolTokens, poolTokens.address, {logger})
    logger("Updated PoolTokens config address to:", poolTokens.address)
    return poolTokens
  }

  async function deployTranchedPool(config) {
    const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})

    logger("About to deploy TranchedPool...")
    let contractName = "TranchedPool"

    if (isTestEnv()) {
      contractName = "TestTranchedPool"
    }

    const tranchedPoolImpl = await deploy(contractName, {
      from: proxy_owner,
      libraries: {["Accountant"]: accountant.address},
    })
    await updateConfig(config, "address", CONFIG_KEYS.TranchedPoolImplementation, tranchedPoolImpl.address, {logger})
    logger("Updated TranchedPool config address to:", tranchedPoolImpl.address)
    return tranchedPoolImpl
  }

  async function deploySeniorFundFidu(config) {
    logger("About to deploy SeniorFundFidu...")
    const fiduDeployResult = await deploy("SeniorFundFidu", {
      from: proxy_owner,
      gas: 4000000,
      proxy: {
        methodName: "__initialize__",
      },
      args: [protocol_owner, "SeniorFundFidu", "sFIDU", config.address],
    })
    const fidu = await ethers.getContractAt("SeniorFundFidu", fiduDeployResult.address)
    await updateConfig(config, "address", CONFIG_KEYS.SeniorFundFidu, fidu.address, {logger})
    logger("Deployed SeniorFundFidu to address:", fidu.address)
    return fidu
  }
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

async function deploySeniorFund(hre, {config}) {
  let contractName = "SeniorFund"
  if (isTestEnv()) {
    contractName = "TestSeniorFund"
  }
  const {deployments, getNamedAccounts} = hre
  const {deploy, log} = deployments
  const logger = log
  const {protocol_owner, proxy_owner} = await getNamedAccounts()

  let deployResult = await deploy(contractName, {
    from: proxy_owner,
    proxy: {methodName: "initialize"},
    args: [protocol_owner, config.address],
  })
  logger("SeniorFund was deployed to:", deployResult.address)
  const fund = await ethers.getContractAt(contractName, deployResult.address)
  await updateConfig(config, "address", CONFIG_KEYS.SeniorFund, fund.address, {logger})

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

module.exports = baseDeploy

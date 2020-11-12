/* globals ethers */
const BN = require("bn.js")
const {
  USDCDecimals,
  upgrade,
  OWNER_ROLE,
  CONFIG_KEYS,
  MINTER_ROLE,
  updateConfig,
  getUSDCAddress,
  isTestEnv,
} = require("./deployHelpers.js")
const PROTOCOL_CONFIG = require("../protocol_config.json")
let logger

async function baseDeploy(hre, {shouldUpgrade}) {
  const {deployments, getNamedAccounts, getChainId, ethers} = hre
  const {deploy, log} = deployments
  logger = log
  logger("Starting deploy...")
  const {protocol_owner, proxy_owner} = await getNamedAccounts()
  logger("Will be deploying using the protocol_owner account:", protocol_owner)

  const chainID = await getChainId()
  logger("Chain ID is:", chainID)
  const config = await deployConfig(deploy, {shouldUpgrade})
  await getOrDeployUSDC()
  const fidu = await deployFidu(config)
  const pool = await deployPool(hre, {shouldUpgrade, config})
  await grantMinterRoleToPool(fidu, pool)
  await deployCreditLine(deploy, {config})
  await deployCreditLineFactory(deploy, {shouldUpgrade, config})
  const creditDesk = await deployCreditDesk(deploy, {shouldUpgrade, config})

  await grantOwnershipOfPoolToCreditDesk(pool, creditDesk.address)

  // Internal functions.

  async function deployConfig(deploy, {shouldUpgrade}) {
    const configOptionsDeployResult = await deploy("ConfigOptions", {from: proxy_owner, gas: 4000000, args: []})
    logger("ConfigOptions was deployed to:", configOptionsDeployResult.address)
    let contractName = "GoldfinchConfig"

    if (isTestEnv()) {
      contractName = "TestGoldfinchConfig"
    }

    let deployResult
    let config
    if (shouldUpgrade) {
      deployResult = await upgrade(deploy, contractName, proxy_owner, {
        gas: 4000000,
        args: [],
        libraries: {["ConfigOptions"]: configOptionsDeployResult.address},
      })
    } else {
      deployResult = await deploy(contractName, {
        from: proxy_owner,
        proxy: {methodName: "initialize"},
        gas: 4000000,
        args: [protocol_owner],
        libraries: {["ConfigOptions"]: configOptionsDeployResult.address},
      })
    }
    logger("Config was deployed to:", deployResult.address)
    config = await ethers.getContractAt(deployResult.abi, deployResult.address)
    const transactionLimit = new BN(PROTOCOL_CONFIG.transactionLimit).mul(USDCDecimals)
    const totalFundsLimit = new BN(PROTOCOL_CONFIG.totalFundsLimit).mul(USDCDecimals)
    const maxUnderwriterLimit = new BN(PROTOCOL_CONFIG.maxUnderwriterLimit).mul(USDCDecimals)
    const reserveDenominator = new BN(PROTOCOL_CONFIG.reserveDenominator)
    const withdrawFeeDenominator = new BN(PROTOCOL_CONFIG.withdrawFeeDenominator)
    const latenessGracePeriod = new BN(PROTOCOL_CONFIG.latenessGracePeriod)
    const latenessMaxPeriod = new BN(PROTOCOL_CONFIG.latenessMaxPeriod)

    await updateConfig(config, "number", CONFIG_KEYS.TotalFundsLimit, String(totalFundsLimit))
    await updateConfig(config, "number", CONFIG_KEYS.TransactionLimit, String(transactionLimit))
    await updateConfig(config, "number", CONFIG_KEYS.MaxUnderwriterLimit, String(maxUnderwriterLimit))
    await updateConfig(config, "number", CONFIG_KEYS.ReserveDenominator, String(reserveDenominator))
    await updateConfig(config, "number", CONFIG_KEYS.WithdrawFeeDenominator, String(withdrawFeeDenominator))
    await updateConfig(config, "number", CONFIG_KEYS.LatenessGracePeriod, String(latenessGracePeriod))
    await updateConfig(config, "number", CONFIG_KEYS.LatenessMaxPeriod, String(latenessMaxPeriod))
    await updateConfig(config, "address", CONFIG_KEYS.ProtocolAdmin, protocol_owner)
    await config.setTreasuryReserve(protocol_owner)

    return config
  }

  async function grantMinterRoleToPool(fidu, pool) {
    if (!(await fidu.hasRole(MINTER_ROLE, pool.address))) {
      await fidu.grantRole(MINTER_ROLE, pool.address)
    }
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

  async function deployCreditLine(deploy, {config}) {
    let clDeployResult = await deploy("CreditLine", {
      from: proxy_owner,
      gas: 4000000,
      args: [],
    })
    logger("CreditLine was deployed to:", clDeployResult.address)
    const clImplementation = await ethers.getContractAt("CreditLine", clDeployResult.address)
    await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, clImplementation.address)
    return clImplementation
  }

  async function deployCreditLineFactory(deploy, {shouldUpgrade, config}) {
    let clFactoryDeployResult
    logger(`Deploying credit line factory; ${shouldUpgrade}`)
    if (shouldUpgrade) {
      clFactoryDeployResult = await upgrade(deploy, "CreditLineFactory", proxy_owner, {gas: 4000000, args: []})
    } else {
      clFactoryDeployResult = await deploy("CreditLineFactory", {
        from: proxy_owner,
        proxy: {owner: proxy_owner, methodName: "initialize"},
        gas: 4000000,
        args: [protocol_owner, config.address],
      })
    }
    logger("CreditLineFactory was deployed to:", clFactoryDeployResult.address)

    const creditLineFactory = await ethers.getContractAt("CreditLineFactory", clFactoryDeployResult.address)

    await updateConfig(config, "address", CONFIG_KEYS.CreditLineFactory, creditLineFactory.address)
    return creditLineFactory
  }

  async function deployCreditDesk(deploy, {shouldUpgrade, config}) {
    const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []})
    logger("Accountant was deployed to:", accountant.address)

    let contractName = "CreditDesk"

    if (isTestEnv()) {
      contractName = "TestCreditDesk"
    }

    let creditDeskDeployResult
    if (shouldUpgrade) {
      creditDeskDeployResult = await upgrade(deploy, contractName, proxy_owner, {
        gas: 4000000,
        args: [],
        libraries: {["Accountant"]: accountant.address},
      })
    } else {
      creditDeskDeployResult = await deploy(contractName, {
        from: proxy_owner,
        proxy: {owner: proxy_owner, methodName: "initialize"},
        gas: 4000000,
        args: [protocol_owner, config.address],
        libraries: {["Accountant"]: accountant.address},
      })
    }
    logger("Credit Desk was deployed to:", creditDeskDeployResult.address)
    await updateConfig(config, "address", CONFIG_KEYS.CreditDesk, creditDeskDeployResult.address)
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
    await updateConfig(config, "address", CONFIG_KEYS.Fidu, fidu.address, logger)
    logger("Deployed Fidu to address:", fidu.address)
    return fidu
  }
}

async function deployPool(hre, {shouldUpgrade, config}) {
  let contractName = "Pool"
  if (isTestEnv()) {
    contractName = "TestPool"
  }
  const {deployments, getNamedAccounts, getChainId} = hre
  const {deploy, log} = deployments
  const logger = log
  const chainID = await getChainId()
  const {protocol_owner, proxy_owner} = await getNamedAccounts()

  logger("Starting deploy...")
  logger("Chain ID is:", chainID)

  let poolDeployResult
  if (shouldUpgrade) {
    poolDeployResult = await upgrade(deploy, contractName, proxy_owner, {gas: 4000000, args: []})
  } else {
    poolDeployResult = await deploy(contractName, {
      from: proxy_owner,
      proxy: {methodName: "initialize"},
      args: [protocol_owner, config.address],
    })
  }
  logger("Pool was deployed to:", poolDeployResult.address)
  const pool = await ethers.getContractAt(contractName, poolDeployResult.address)
  await updateConfig(config, "address", CONFIG_KEYS.Pool, pool.address, logger)

  return pool
}

module.exports = baseDeploy

/* global ethers */
const BN = require("bn.js")
const hre = require("hardhat")
require("dotenv").config({path: ".env.local"})
const {CONFIG_KEYS} = require("../blockchain_scripts/configKeys")
const {
  MAINNET_CHAIN_ID,
  LOCAL,
  CHAIN_MAPPING,
  updateConfig,
  getUSDCAddress,
  getERC20Address,
  USDCDecimals,
  isTestEnv,
  interestAprAsBN,
  isMainnetForking,
  getSignerForAddress,
} = require("../blockchain_scripts/deployHelpers.js")
const {
  MAINNET_MULTISIG,
  upgradeContracts,
  getExistingContracts,
  impersonateAccount,
  fundWithWhales,
  getMainnetContracts,
  performPostUpgradeMigration,
} = require("../blockchain_scripts/mainnetForkingHelpers")
const PROTOCOL_CONFIG = require("../protocol_config.json")

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/
let logger
async function main({getNamedAccounts, deployments, getChainId}) {
  const {getOrNull, log} = deployments
  logger = log
  let {protocol_owner} = await getNamedAccounts()
  let chainID = await getChainId()
  let underwriter = protocol_owner
  let borrower = protocol_owner
  let pool = await getDeployedAsEthersContract(getOrNull, "Pool")
  let creditDesk = await getDeployedAsEthersContract(getOrNull, "CreditDesk")
  let erc20 = await getDeployedAsEthersContract(getOrNull, "TestERC20")
  let config = await getDeployedAsEthersContract(getOrNull, "GoldfinchConfig")
  let creditLineFactory = await getDeployedAsEthersContract(getOrNull, "CreditLineFactory")
  await setupTestForwarder(deployments, config, getOrNull, protocol_owner)

  if (getUSDCAddress(chainID)) {
    logger("On a network with known USDC address, so firing up that contract...")
    erc20 = await ethers.getContractAt("TestERC20", getUSDCAddress(chainID))
  }

  let erc20s = [
    {
      ticker: "USDC",
      contract: erc20,
    },
  ]

  if (isMainnetForking()) {
    console.log("Funding protocol_owner with whales")
    underwriter = MAINNET_MULTISIG
    await impersonateAccount(hre, MAINNET_MULTISIG)
    let ownerAccount = await getSignerForAddress(protocol_owner)
    erc20s = erc20s.concat([
      {
        ticker: "USDT",
        contract: await ethers.getContractAt("IERC20withDec", getERC20Address("USDT", chainID)),
      },
      {
        ticker: "BUSD",
        contract: await ethers.getContractAt("IERC20withDec", getERC20Address("BUSD", chainID)),
      },
    ])

    await ownerAccount.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("5.0")})
    await fundWithWhales(erc20s, [protocol_owner])

    const mainnetConfig = getMainnetContracts()
    const contractsToUpgrade = ["CreditDesk", "Pool", "Fidu", "CreditLineFactory", "GoldfinchConfig"]
    const upgradedContracts = await upgradeExistingContracts(
      contractsToUpgrade,
      mainnetConfig,
      MAINNET_MULTISIG,
      protocol_owner,
      deployments
    )

    creditDesk = upgradedContracts.CreditDesk.UpgradedContract
    pool = upgradedContracts.Pool.UpgradedContract
    creditLineFactory = upgradedContracts.CreditLineFactory.UpgradedContract

    await performPostUpgradeMigration(upgradedContracts, deployments)
  }

  const testUser = process.env.TEST_USER
  if (testUser) {
    borrower = testUser
    if (CHAIN_MAPPING[chainID] === LOCAL) {
      await giveMoneyToTestUser(testUser, erc20s)
    }
  }

  await depositFundsToThePool(pool, erc20)
  await createUnderwriter(creditDesk, underwriter)

  const result = await (await creditLineFactory.createBorrower(borrower)).wait()
  let bwrConAddr = result.events[result.events.length - 1].args[0]
  logger(`Created borrower contract: ${bwrConAddr} for ${borrower}`)

  await createCreditLineForBorrower(creditDesk, creditLineFactory, bwrConAddr)
  await createCreditLineForBorrower(creditDesk, creditLineFactory, bwrConAddr)
}

async function upgradeExistingContracts(contractsToUpgrade, mainnetConfig, mainnetMultisig, deployFrom, deployments) {
  // Ensure the multisig has funds for upgrades and other transactions
  console.log("On mainnet fork, upgrading existing contracts")
  let ownerAccount = await getSignerForAddress(deployFrom)
  await ownerAccount.sendTransaction({to: mainnetMultisig, value: ethers.utils.parseEther("5.0")})
  await impersonateAccount(hre, mainnetMultisig)
  let mainnetSigner = await ethers.provider.getSigner(mainnetMultisig)

  let contracts = await getExistingContracts(contractsToUpgrade, mainnetConfig, mainnetSigner)
  contracts = await upgradeContracts(contractsToUpgrade, contracts, mainnetSigner, deployFrom, deployments)
  return contracts
}

async function depositFundsToThePool(pool, erc20) {
  logger("Depositing funds into the pool...")
  const originalBalance = await erc20.balanceOf(pool.address)
  if (originalBalance.gt("0")) {
    logger(`Looks like the pool already has ${originalBalance} of funds...`)
    return
  }

  // Approve first
  logger("Approving the owner to deposit funds...")
  var txn = await erc20.approve(pool.address, String(new BN(1000000).mul(USDCDecimals)))
  await txn.wait()
  logger("Depositing funds...")
  let depositAmount
  depositAmount = new BN(10000).mul(USDCDecimals)

  // eslint-disable-next-line no-redeclare
  var txn = await pool.deposit(String(depositAmount))
  await txn.wait()
  const newBalance = await erc20.balanceOf(pool.address)
  if (String(newBalance) != String(depositAmount)) {
    throw new Error(`Expected to deposit ${depositAmount} but got ${newBalance}`)
  }
}

async function giveMoneyToTestUser(testUser, erc20s) {
  logger("Sending money to the test user", testUser)
  const [protocol_owner] = await ethers.getSigners()
  await protocol_owner.sendTransaction({
    to: testUser,
    value: ethers.utils.parseEther("10.0"),
  })

  let ten = new BN(10)
  for (let erc20 of erc20s) {
    const {contract} = erc20
    let decimals = ten.pow(new BN(await contract.decimals()))
    await contract.transfer(testUser, String(new BN(10000).mul(decimals)))
  }
}

async function getDeployedAsEthersContract(getter, name) {
  logger("Trying to get the deployed version of...", name)
  let deployed = await getter(name)
  if (!deployed && isTestEnv()) {
    deployed = await getter(`Test${name}`)
  }
  if (!deployed) {
    return null
  }
  return await ethers.getContractAt(deployed.abi, deployed.address)
}

async function createUnderwriter(creditDesk, newUnderwriter) {
  logger("Trying to create an Underwriter...", newUnderwriter)
  const alreadyUnderwriter = await creditDesk.underwriters(newUnderwriter)
  if (alreadyUnderwriter.gt("0")) {
    logger("We have already created this address as an underwriter")
    return
  }
  logger("Creating an underwriter with governance limit", newUnderwriter)
  const txn = await creditDesk.setUnderwriterGovernanceLimit(
    newUnderwriter,
    String(new BN(PROTOCOL_CONFIG.maxUnderwriterLimit).mul(USDCDecimals))
  )
  await txn.wait()
  const onChain = await creditDesk.underwriters(newUnderwriter)
  if (!onChain.gt("0")) {
    throw new Error(
      `The transaction did not seem to work. Could not find underwriter ${newUnderwriter} on the CreditDesk`
    )
  }
}

async function createCreditLineForBorrower(creditDesk, creditLineFactory, borrower) {
  logger("Trying to create an CreditLine for the Borrower...")

  logger("Creating a credit line for the borrower", borrower)
  const limit = String(new BN(10000).mul(USDCDecimals))
  const interestApr = String(interestAprAsBN("5.00"))
  const paymentPeriodInDays = String(new BN(30))
  const termInDays = String(new BN(360))
  const lateFeeApr = String(new BN(0))
  await creditDesk.createCreditLine(borrower, limit, interestApr, paymentPeriodInDays, termInDays, lateFeeApr)
  logger("Created a credit line for the borrower", borrower)
}

async function setupTestForwarder(deployments, config, getOrNull, protocol_owner) {
  let deployResult = await deployments.deploy("TestForwarder", {
    from: protocol_owner,
    gas: 4000000,
  })
  logger(`Created Forwarder at ${deployResult.address}`)

  let forwarder = await getDeployedAsEthersContract(getOrNull, "TestForwarder")
  await forwarder.registerDomainSeparator("Defender", "1")

  await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, deployResult.address, {logger})
}

module.exports = main
module.exports.dependencies = ["base_deploy"]
module.exports.tags = ["setup_for_testing"]
module.exports.skip = async ({getChainId}) => {
  const chainId = await getChainId()
  return String(chainId) === MAINNET_CHAIN_ID
}

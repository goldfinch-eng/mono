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
  USDCDecimals,
  isTestEnv,
  interestAprAsBN,
  isMainnetForking,
} = require("../blockchain_scripts/deployHelpers.js")
const PROTOCOL_CONFIG = require("../protocol_config.json")

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/
let logger
async function main({getNamedAccounts, deployments, getChainId}) {
  const {getOrNull, log} = deployments
  logger = log
  const {protocol_owner} = await getNamedAccounts()
  let chainID = await getChainId()
  let underwriter = protocol_owner
  let borrower = protocol_owner
  const pool = await getDeployedAsEthersContract(getOrNull, "Pool")
  const creditDesk = await getDeployedAsEthersContract(getOrNull, "CreditDesk")
  let erc20 = await getDeployedAsEthersContract(getOrNull, "TestERC20")
  const config = await getDeployedAsEthersContract(getOrNull, "GoldfinchConfig")
  const creditLineFactory = await getDeployedAsEthersContract(getOrNull, "CreditLineFactory")
  await setupTestForwarder(deployments, config, getOrNull, protocol_owner)

  if (getUSDCAddress(chainID)) {
    logger("On a network with known USDC address, so firing up that contract...")
    erc20 = await ethers.getContractAt("TestERC20", getUSDCAddress(chainID))

    if (isMainnetForking()) {
      const usdcWhale = "0x46aBbc9fc9d8E749746B00865BC2Cf7C4d85C837"
      // Unlocks a random account that owns tons of USDC, which we can send to our test users
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [usdcWhale],
      })
      // Give USDC from the whale to our test accounts
      console.log("Mainnet fork detected. Transferring USDC to protocol owner")
      let signer = await ethers.provider.getSigner(usdcWhale)
      const whaleUSDC = await ethers.getContractAt("TestERC20", getUSDCAddress(chainID), signer)
      await whaleUSDC.transfer(protocol_owner, new BN(1000000).mul(USDCDecimals).toString())
    }
  }

  const testUser = process.env.TEST_USER
  console.log("TEST USER IS:", testUser)
  if (testUser) {
    borrower = testUser
    if (CHAIN_MAPPING[chainID] === LOCAL) {
      await giveMoneyToTestUser(testUser, erc20)
    }
  }

  await depositFundsToThePool(pool, erc20)
  await createUnderwriter(creditDesk, underwriter)
  await createCreditLineForBorrower(creditDesk, creditLineFactory, borrower)
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

async function giveMoneyToTestUser(testUser, erc20) {
  logger("Sending money to the test user", testUser)
  const [protocol_owner] = await ethers.getSigners()
  await protocol_owner.sendTransaction({
    to: testUser,
    value: ethers.utils.parseEther("10.0"),
  })
  const result = await erc20.transfer(testUser, String(new BN(10000).mul(USDCDecimals)))
  await result.wait()
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
  const existingCreditLines = await creditDesk.getBorrowerCreditLines(borrower)
  if (existingCreditLines.length) {
    logger("We have already created a credit line for this borrower")
    return
  }

  const result = await (await creditLineFactory.createBorrower(borrower)).wait()
  let bwrConAddr = result.events[result.events.length - 1].args[0]
  logger(`Created borrower contract: ${bwrConAddr} for ${borrower}`)
  borrower = bwrConAddr

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

  await updateConfig(config, "address", CONFIG_KEYS.TrustedForwarder, deployResult.address)
}

module.exports = main
module.exports.dependencies = ["base_deploy"]
module.exports.tags = ["setup_for_testing"]
module.exports.skip = async ({getChainId}) => {
  const chainId = await getChainId()
  return String(chainId) === MAINNET_CHAIN_ID
}

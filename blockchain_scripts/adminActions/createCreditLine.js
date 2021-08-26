const BN = require("bn.js")
const hre = require("hardhat")
const DefenderUpgrader = require("../v1.1/defenderUpgrader").default
const {deployments, getNamedAccounts, getChainId} = hre
const {USDCDecimals, getDeployedContract, interestAprAsBN, MAINNET_CHAIN_ID} = require("../deployHelpers.js")
const {displayCreditLine} = require("../protocolHelpers")

async function main() {
  const {gf_deployer} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", gf_deployer)
  const goldfinchFactory = await getDeployedContract(deployments, "GoldfinchFactory", gf_deployer)
  const borrower = process.env.BORROWER
  const bwrConAddr = process.env.BORROWER_CONTRACT
  if (!borrower && !bwrConAddr) {
    throw new Error(
      "No borrower or borrower contract provided. \
      Please run again, passing borrower as BORROWER={{address}} or BORROWER_CONTRACT={address}"
    )
  }

  await createCreditLineForBorrower(creditDesk, goldfinchFactory, borrower, bwrConAddr)
}

async function createCreditLineForBorrower(creditDesk, goldfinchFactory, borrower, bwrConAddr, logger = console.log) {
  logger("Trying to create an CreditLine for the Borrower...")

  if (!bwrConAddr) {
    console.log("No borrower contract passed in, so creating one...")
    let txn = await goldfinchFactory.createBorrower(borrower)
    console.log("Borrower con txn:", txn)
    const result = await txn.wait()
    bwrConAddr = result.events[result.events.length - 1].args[0]
    logger(`Created borrower contract: ${bwrConAddr} for ${borrower}`)
  } else {
    console.log("Borrower contract detected, so using it:", bwrConAddr)
  }
  borrower = bwrConAddr

  const chainId = await getChainId()

  logger("Creating a credit line for the borrower", borrower)
  const limit = String(new BN(1000000).mul(USDCDecimals))
  const interestApr = String(interestAprAsBN("15.00"))
  const paymentPeriodInDays = String(new BN(30))
  const termInDays = String(new BN(360))
  const lateFeeApr = String(new BN(3))
  if (chainId === MAINNET_CHAIN_ID) {
    console.log("On mainnet, so creating credit line on Defender")
    const defender = new DefenderUpgrader({hre, logger, chainId})
    await defender.createCreditLine(creditDesk, {
      borrower,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
    })
  } else {
    console.log("Not on mainnet, so creating a credit line directly")
    const txn = await creditDesk.createCreditLine(
      borrower,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr
    )
    logger("Waiting for the txn to be mined...")
    await txn.wait()
    const creditLines = await creditDesk.getBorrowerCreditLines(borrower)
    await displayCreditLine(creditLines[creditLines.length - 1])
    logger("Created a credit line for the borrower", borrower)
  }
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = createCreditLineForBorrower

const BN = require("bn.js")
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {USDCDecimals, getDeployedContract, interestAprAsBN} = require("../blockchain_scripts/deployHelpers.js")
const {displayCreditLine} = require("./protocolHelpers")

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", protocolOwner)
  const creditLineFactory = await getDeployedContract(deployments, "CreditLineFactory", protocolOwner)
  const borrower = process.env.BORROWER
  if (!borrower) {
    throw new Error("No borrower provided. Please run again, passing borrower as BORROWER={{borrower_address}}")
  }

  await createCreditLineForBorrower(creditDesk, creditLineFactory, borrower)
}

async function createCreditLineForBorrower(creditDesk, creditLineFactory, borrower, logger = console.log) {
  logger("Trying to create an CreditLine for the Borrower...")
  const existingCreditLines = await creditDesk.getBorrowerCreditLines(borrower)
  if (existingCreditLines && existingCreditLines.length) {
    logger("We have already created a credit line for this borrower")
    return
  }

  const result = await (await creditLineFactory.createBorrower(borrower)).wait()
  let bwrConAddr = result.events[result.events.length - 1].args[0]
  logger(`Created borrower contract: ${bwrConAddr} for ${borrower}`)
  borrower = bwrConAddr

  logger("Creating a credit line for the borrower", borrower)
  const limit = String(new BN(80000).mul(USDCDecimals))
  const interestApr = String(interestAprAsBN("5.00"))
  const paymentPeriodInDays = String(new BN(7))
  const termInDays = String(new BN(360))
  const lateFeeApr = String(new BN(3))
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

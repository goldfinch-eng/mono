/* globals */
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")
const {migrateCreditLine, getCreditLine} = require("./protocolHelpers")

async function main() {
  const creditLineAddresses = process.env.CREDIT_LINES
  const termInDays = process.env.TERM_IN_DAYS
  const borrower = process.env.BORROWER
  const limit = process.env.LIMIT
  const interestApr = process.env.INTEREST_APR
  const paymentPeriodInDays = process.env.PAYMENT_PERIOD_IN_DAYS
  const lateFeeApr = process.env.LATE_FEE_APR
  const {protocolOwner} = getNamedAccounts()

  if (!creditLineAddresses) {
    throw new Error("You must supply a credit line address when migrating credit lines!")
  }

  if (!borrower) {
    throw new Error("You must supply an existing borrower when migrating to a borrower contract")
  }

  console.log("Creating the borrower contract...")
  let creditLineFactory = await getDeployedContract(deployments, "CreditLineFactory", protocolOwner)
  const result = await (await creditLineFactory.createBorrower(borrower)).wait()
  let bwrConAddr = result.events[result.events.length - 1].args[0]
  console.log("Created borrower contract at:", bwrConAddr)

  creditLineAddresses.split(",").forEach(async (clAddress) => {
    const creditLine = await getCreditLine(clAddress)
    if ((await creditLine.balance()).eq("0")) {
      throw new Error("Credit line has a zero balance so is not migrateable!")
    }

    await migrateCreditLine(clAddress, {
      termInDays,
      borrower: bwrConAddr,
      limit,
      interestApr,
      paymentPeriodInDays,
      lateFeeApr,
    })
  })
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

module.exports = main

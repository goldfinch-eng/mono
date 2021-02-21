/* globals */
const BN = require("bn.js")
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")
const {migrateCreditLine, getCreditLine} = require("./protocolHelpers")

async function main() {
  const creditLineAddress = process.env.CREDIT_LINE
  const termInDays = process.env.TERM_IN_DAYS
  const borrower = process.env.BORROWER
  const limit = process.env.LIMIT
  const interestApr = process.env.INTEREST_APR
  const paymentPeriodInDays = process.env.PAYMENT_PERIOD_IN_DAYS
  const lateFeeApr = process.env.LATE_FEE_APR
  const {protocolOwner} = getNamedAccounts()

  if (!creditLineAddress) {
    throw new Error("You must supply a credit line address when migrating credit lines!")
  }

  if (!borrower) {
    throw new Error("You must supply an existing borrower when migrating to a borrower contract")
  }

  const creditLine = getCreditLine(creditLineAddress)
  if (!(await creditLine.balance()).gt(new BN(0))) {
    throw new Error("Credit line has a zero balance so is not migrateable!")
  }

  const creditLineFactory = getDeployedContract(deployments, "CreditLineFactory", protocolOwner)
  const result = await (await creditLineFactory.createBorrower(borrower)).wait()
  let bwrConAddr = result.events[result.events.length - 1].args[0]

  await migrateCreditLine(creditLineAddress, {
    termInDays,
    bwrConAddr,
    limit,
    interestApr,
    paymentPeriodInDays,
    lateFeeApr,
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

/* globals ethers */
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {getDeployedContract} = require("./deployHelpers.js")
const CreditLine = require("../artifacts/contracts/protocol/CreditLine.sol/CreditLine.json")
const {displayCreditLine} = require("./protocolHelpers")

async function main() {
  const creditLineAddress = process.env.CREDIT_LINE
  const termInDays = process.env.TERM_IN_DAYS
  const borrower = process.env.BORROWER
  const limit = process.env.LIMIT
  const interestApr = process.env.INTEREST_APR
  const paymentPeriodInDays = process.env.PAYMENT_PERIOD_IN_DAYS
  const lateFeeApr = process.env.LATE_FEE_APR
  await migrateCreditLine(creditLineAddress, {
    termInDays,
    borrower,
    limit,
    interestApr,
    paymentPeriodInDays,
    lateFeeApr,
  })

  async function migrateCreditLine(creditLineAddress, creditLineOpts) {
    if (!creditLineAddress) {
      throw new Error("You did not pass term in days or credit line address!")
    }
    const {protocolOwner} = await getNamedAccounts()
    const creditDesk = await getDeployedContract(deployments, "CreditDesk", protocolOwner)
    const creditLine = await ethers.getContractAt(CreditLine.abi, creditLineAddress)
    const txn = await creditDesk.migrateCreditLine(
      creditLineAddress,
      creditLineOpts.borrower || (await creditLine.borrower()),
      creditLineOpts.limit || (await creditLine.limit()),
      creditLineOpts.interestApr || (await creditLine.interestApr()),
      creditLineOpts.paymentPeriodInDays || (await creditLine.paymentPeriodInDays()),
      creditLineOpts.termInDays || (await creditLine.termInDays()),
      creditLineOpts.lateFeeApr || (await creditLine.lateFeeApr())
    )
    await txn.wait()
    await displayCreditLine(creditLineAddress)
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

module.exports = main

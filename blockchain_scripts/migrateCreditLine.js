/* globals */
const {migrateCreditLine} = require("./protocolHelpers.js")

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

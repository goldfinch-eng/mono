const hre = require("hardhat")

const BORROWER = "0x618C20c64cAc5211E099D355ba213790708e7462"
const GOLDFINCH_FACTORY = "0x318B051eeb3035b99fE658BAbC3C6cf1F8201806"
const JUNIOR_FEE_PERCENT = "20"
const LIMIT = "10000"
const INTEREST_APR = "5"
const PAYMENT_PERIOD_IN_DAYS = "30"
const TERM_IN_DAYS = "360"
const LATE_FEE_APR = "0"
const PRINCIPAL_GRACE_PERIOD_IN_DAYS = "185"
const FUNDABLE_AT = "0"
const ALLOWED_UID = [1, 2, 3]

async function main() {
  const GoldfinchFactory = await hre.ethers.getContractFactory("GoldfinchFactory")
  const factory = await GoldfinchFactory.attach(GOLDFINCH_FACTORY)
  const receipt = await factory.createPool(
    BORROWER,
    JUNIOR_FEE_PERCENT,
    LIMIT,
    INTEREST_APR,
    PAYMENT_PERIOD_IN_DAYS,
    TERM_IN_DAYS,
    LATE_FEE_APR,
    PRINCIPAL_GRACE_PERIOD_IN_DAYS,
    FUNDABLE_AT,
    ALLOWED_UID
  )
  const result = await receipt.wait()
  console.log(result)
  const address = getPoolAddress(result)
  console.log(address)
}

function getPoolAddress(result) {
  const events = result.events
  const lastEvent = events[events.length - 1]
  return lastEvent.args[0]
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

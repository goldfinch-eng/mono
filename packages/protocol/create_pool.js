const hre = require("hardhat")

const BORROWER = "0xd48D73Acc0bE37936BBa4E9fC326A87Fc1FeD7E5"
const GOLDFINCH_FACTORY = "0xa8B84432e5353e9820c22E45D6B14A5406cb6879"
const JUNIOR_FEE_PERCENT = "20"
const LIMIT = "1000000000"
const INTEREST_APR = "50000000000000000" // 5% APR
const PAYMENT_PERIOD_IN_DAYS = "30"
const TERM_IN_DAYS = "365"
const LATE_FEE_APR = "0"
const PRINCIPAL_GRACE_PERIOD_IN_DAYS = "185"
const FUNDABLE_AT = "0"
const ALLOWED_UID = [0]

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

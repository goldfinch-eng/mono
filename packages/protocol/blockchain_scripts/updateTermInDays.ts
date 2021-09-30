import BN from "bn.js"
import CreditLine from "../artifacts/contracts/protocol/core/CreditLine.sol/CreditLine.json"
import {SECONDS_PER_DAY} from "../test/testHelpers"
import {displayCreditLine} from "./protocolHelpers"
import {ethers} from "hardhat"
import {assertNonNullable} from "packages/utils/src/type"

async function main() {
  assertNonNullable(process.env.CREDIT_LINE, "You did not pass term in days or credit line address!")
  assertNonNullable(process.env.TERM_IN_DAYS, "You did not pass term in days or credit line address!")

  const creditLineAddress = process.env.CREDIT_LINE
  const newTermInDays = new BN(process.env.TERM_IN_DAYS)
  await updateTermInDays(creditLineAddress, newTermInDays)

  async function updateTermInDays(creditLineAddress: string, newTermInDays: BN) {
    console.log("Updating term end block based on term in days...")
    const creditLine = await ethers.getContractAt(CreditLine.abi, creditLineAddress)
    const currentTermInDays = await creditLine.termInDays()
    const currentTermEndTime = await creditLine.termEndTime()
    const originalTermStartTime = currentTermEndTime.sub(String(currentTermInDays.mul(String(SECONDS_PER_DAY))))
    const newTermEndTime = originalTermStartTime.add(String(newTermInDays.mul(SECONDS_PER_DAY)))
    console.log("Setting termEndTime to:", String(newTermEndTime), "from:", String(currentTermEndTime))
    await Promise.all([creditLine.setTermEndTime(String(newTermEndTime))])
    console.log("-------------------")
    console.log("Note that term in days was NOT set. You must migrate to a new credit line in order to set that...")
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

export default main

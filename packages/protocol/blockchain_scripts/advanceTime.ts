import hre from "hardhat"
import BN from "bn.js"
import {SECONDS_PER_DAY} from "../test/testHelpers"

async function main() {
  await advanceTime()
}

async function advanceTime(logger = console.log) {
  const daysToAdvance = new BN(process.env.DAYS || "10")
  const secondsToAdvance = SECONDS_PER_DAY.mul(daysToAdvance)
  const newTimestamp = new BN(Math.round(Date.now() / 1000)).add(new BN(secondsToAdvance))
  logger(`Advancing time by ${daysToAdvance.toString()} days (timestamp: ${newTimestamp.toNumber()})`)
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [newTimestamp.toNumber()],
  })
  logger("Done")
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

export default advanceTime

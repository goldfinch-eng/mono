const hre = require("hardhat")
const BN = require("bn.js")
const {BLOCKS_PER_DAY} = require("../test/testHelpers.js")

async function main() {
  await advanceTime()
}

async function advanceTime(logger = console.log) {
  const daysToAdvance = new BN(process.env.DAYS || "10")
  const blocksToAdvance = BLOCKS_PER_DAY.mul(daysToAdvance)
  logger(`Advancing time by ${daysToAdvance.toString()} days (${blocksToAdvance.toString()} blocks)`)
  let day = new BN(0)
  for (let i = 1; i <= blocksToAdvance.toNumber(); i++) {
    await hre.network.provider.request({
      method: "evm_mine",
      params: [],
    })
    if (!new BN(i).divRound(BLOCKS_PER_DAY).eq(day)) {
      day = new BN(i).divRound(BLOCKS_PER_DAY)
      logger(`${day.toString()}/${daysToAdvance.toString()}`)
    }
  }
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

module.exports = advanceTime

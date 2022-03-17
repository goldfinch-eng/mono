import chai from "chai"
import chaiSubset from "chai-subset"
chai.use(chaiSubset)
const expect = chai.expect
import {BigNumber} from "bignumber.js"

import {calculateUnlockedCustodyGFI} from "../../src/handlers/circulatingSupply"

const oneMonthInSeconds = 60 * 60 * 24 * 30

describe("calculateUnlockedCustodyGFI", async () => {
  it("returns 0 when before first unlock time", async () => {
    const startingBalance: BigNumber = new BigNumber(100)
    const firstUnlockTimeInSeconds: number = Date.now() / 1000
    const currentTimeInSeconds: number = firstUnlockTimeInSeconds - 1

    expect(
      calculateUnlockedCustodyGFI({
        startingBalance,
        firstUnlockTimeInSeconds,
        currentTimeInSeconds,
      }).toString(),
    ).to.eq("0")
  })

  it("returns 1/6 of startingBalance after the first unlock date", async () => {
    const startingBalance: BigNumber = new BigNumber(100)
    const firstUnlockTimeInSeconds: number = Date.now() / 1000
    const currentTimeInSeconds: number = firstUnlockTimeInSeconds

    expect(
      calculateUnlockedCustodyGFI({
        startingBalance,
        firstUnlockTimeInSeconds,
        currentTimeInSeconds,
      }).toString(),
    ).to.eq(startingBalance.div(6).toString())
  })

  it("returns 1/36 of startingBalance for every month thereafter", async () => {
    const startingBalance: BigNumber = new BigNumber(100)
    const firstUnlockTimeInSeconds: number = Date.now() / 1000
    let currentTimeInSeconds: number = firstUnlockTimeInSeconds + oneMonthInSeconds * 3 + 1

    const expected = startingBalance.div(6).plus(startingBalance.div(36).multipliedBy(3))

    expect(
      calculateUnlockedCustodyGFI({
        startingBalance,
        firstUnlockTimeInSeconds,
        currentTimeInSeconds,
      }).toString(),
    ).to.eq(expected.toString())

    // It maxes out at startingBalance
    currentTimeInSeconds = firstUnlockTimeInSeconds + oneMonthInSeconds * 40
    expect(
      calculateUnlockedCustodyGFI({
        startingBalance,
        firstUnlockTimeInSeconds,
        currentTimeInSeconds,
      }).toString(),
    ).to.eq(startingBalance.toString())
  })
})

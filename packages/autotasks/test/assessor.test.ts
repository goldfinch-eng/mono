import {TRANCHES} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  hardhat,
  BN,
  deployAllContracts,
  advanceTime,
  expectAction,
  erc20Approve,
  usdcVal,
  createPoolWithCreditLine,
  toEthers,
} from "@goldfinch-eng/protocol/test/testHelpers"
const {deployments, web3, ethers} = hardhat
import {assessIfRequired} from "../assessor"
let accounts, owner, underwriter, borrower
let creditLine, fakeProvider, fakeTimestamp
let tranchedPool, seniorPool, poolTokens

describe("assessor", () => {
  const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    // Just to be crystal clear
    const {protocol_owner} = await getNamedAccounts()
    owner = protocol_owner

    const {seniorPool, usdc, fidu, goldfinchConfig, goldfinchFactory, poolTokens} = await deployAllContracts(
      deployments
    )
    // A bit of setup for our test users
    await erc20Approve(usdc, seniorPool.address, usdcVal(100000), [owner, borrower])
    await goldfinchConfig.bulkAddToGoList([owner, underwriter, borrower])
    await seniorPool.deposit(String(usdcVal(10000)), {from: owner})
    const {tranchedPool, creditLine} = await createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      usdc,
    })
    await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
    await tranchedPool.lockJuniorCapital({from: borrower})
    await seniorPool.invest(tranchedPool.address)
    await tranchedPool.lockPool({from: borrower})
    return {usdc, seniorPool, fidu, goldfinchConfig, goldfinchFactory, creditLine, tranchedPool, poolTokens}
  })

  async function advanceToTimestamp(timestamp) {
    fakeTimestamp = timestamp
    await advanceTime({toSecond: fakeTimestamp})
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower] = accounts
    ;({tranchedPool, creditLine, seniorPool, poolTokens} = await setupTest())

    fakeProvider = {
      getBlock: async function () {
        if (!fakeTimestamp) {
          return ethers.provider.getBlock("latest")
        }
        return {timestamp: fakeTimestamp}
      },
    }
  })

  describe("assessIfRequired", async () => {
    let tranchedPoolAsEthers, seniorPoolAsEthers, creditLineAsEthers, poolTokensAsEthers

    beforeEach(async () => {
      tranchedPoolAsEthers = await toEthers(tranchedPool)
      seniorPoolAsEthers = await toEthers(seniorPool)
      creditLineAsEthers = await toEthers(creditLine)
      poolTokensAsEthers = await toEthers(poolTokens)
    })

    it("assesses the credit line", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})
      await tranchedPool.pay(usdcVal(1), {from: borrower})
      // Advance to just beyond the nextDueTime
      await advanceToTimestamp((await creditLine.nextDueTime()).add(new BN(10)))
      await expectAction(() =>
        assessIfRequired(tranchedPoolAsEthers, creditLineAsEthers, fakeProvider, seniorPoolAsEthers, poolTokensAsEthers)
      ).toChange([
        [creditLine.nextDueTime, {increase: true}],
        // [seniorPool.sharePrice, {increase: true}], // The senior pool should redeem the interest payments
      ])
    })

    it("does not assess if within the nextDueTime", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})

      // Advance to just before the next due block
      await advanceToTimestamp((await creditLine.nextDueTime()).sub(new BN(10)))

      await expectAction(() =>
        assessIfRequired(tranchedPoolAsEthers, creditLineAsEthers, fakeProvider, seniorPoolAsEthers, poolTokensAsEthers)
      ).toChange([[creditLine.nextDueTime, {by: "0"}]])
    })

    it("assesses if beyond the term end block", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})

      // Advance to just after the term due block
      await advanceToTimestamp((await creditLine.termEndTime()).add(new BN(10)))

      await expectAction(() =>
        assessIfRequired(tranchedPoolAsEthers, creditLineAsEthers, fakeProvider, seniorPoolAsEthers, poolTokensAsEthers)
      ).toChange([
        [creditLine.nextDueTime, {increase: true}],
        // [seniorPool.sharePrice, {decrease: true}], // There should also be a writedown because there were no payments
        // [seniorPool.totalWritedowns, {increase: true}],
      ])
    })

    it("does not assess if no balance", async () => {
      await expectAction(() =>
        assessIfRequired(tranchedPoolAsEthers, creditLineAsEthers, fakeProvider, seniorPoolAsEthers, poolTokensAsEthers)
      ).toChange([[creditLine.nextDueTime, {by: "0"}]])
    })
  })
})

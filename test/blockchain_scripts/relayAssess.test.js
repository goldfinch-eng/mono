/* global web3 */
const hre = require("hardhat")
const {TRANCHES} = require("../../blockchain_scripts/deployHelpers")
const {deployments} = hre
const {
  BN,
  deployAllContracts,
  advanceTime,
  expectAction,
  erc20Approve,
  usdcVal,
  createPoolWithCreditLine,
} = require("../testHelpers")
const {assessIfRequired} = require("../../autotasks/assessor/index.js")
let accounts, owner, underwriter, borrower
let creditDesk, creditLine, fakeProvider, fakeTimestamp
let tranchedPool
describe("relayAsses", () => {
  const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    // Just to be crystal clear
    const {protocol_owner} = await getNamedAccounts()
    owner = protocol_owner

    const {seniorFund, usdc, fidu, creditDesk, goldfinchConfig, goldfinchFactory} = await deployAllContracts(
      deployments
    )
    // A bit of setup for our test users
    await erc20Approve(usdc, seniorFund.address, usdcVal(100000), [owner, borrower])
    await goldfinchConfig.bulkAddToGoList([owner, underwriter, borrower])
    await seniorFund.deposit(String(usdcVal(10000)), {from: owner})
    const {tranchedPool, creditLine} = await createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      usdc,
    })
    await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
    await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
    await tranchedPool.lockJuniorCapital({from: borrower})
    await tranchedPool.lockPool({from: borrower})
    return {usdc, seniorFund, fidu, goldfinchConfig, creditDesk, goldfinchFactory, creditLine, tranchedPool}
  })

  async function advanceToTimestamp(timestamp) {
    fakeTimestamp = timestamp
    await advanceTime(creditDesk, {toSecond: fakeTimestamp})
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower] = accounts
    ;({creditDesk, tranchedPool, creditLine} = await setupTest())

    fakeProvider = {
      getBlock: async function () {
        if (!fakeTimestamp) {
          return hre.ethers.provider.provider.getBlock("latest")
        }
        return {timestamp: fakeTimestamp}
      },
    }
  })

  describe("assessIfRequired", async () => {
    it("assesses the credit line", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})
      // Advance to just beyond the nextDueTime
      await advanceToTimestamp((await creditLine.nextDueTime()).add(new BN(10)))
      await expectAction(() => assessIfRequired(tranchedPool, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {increase: true}],
      ])
    })

    it("does not assess if within the nextDueTime", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})

      // Advance to just before the next due block
      await advanceToTimestamp((await creditLine.nextDueTime()).sub(new BN(10)))

      await expectAction(() => assessIfRequired(tranchedPool, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {by: 0}],
      ])
    })

    it("assesses if beyond the term end block", async () => {
      await tranchedPool.drawdown(usdcVal(10), {from: borrower})

      // Advance to just after the term due block
      await advanceToTimestamp((await creditLine.termEndTime()).add(new BN(10)))

      await expectAction(() => assessIfRequired(tranchedPool, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {increase: true}],
      ])
    })

    it("does not assess if no balance", async () => {
      await expectAction(() => assessIfRequired(tranchedPool, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {by: 0}],
      ])
    })
  })
})

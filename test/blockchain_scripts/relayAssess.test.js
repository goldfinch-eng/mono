/* global artifacts web3 */
const hre = require("hardhat")
const {interestAprAsBN} = require("../../blockchain_scripts/deployHelpers")
const {deployments} = hre
const {BN, deployAllContracts, advanceTime, expectAction, erc20Approve, usdcVal} = require("../testHelpers.js")
const {assessIfRequired} = require("../../autotasks/assessor/index.js")
const CreditLine = artifacts.require("CreditLine")

let accounts, owner, underwriter, borrower
let creditDesk, creditLine, fakeProvider, fakeTimestamp

describe("relayAsses", () => {
  let limit = usdcVal(10000)
  let interestApr = interestAprAsBN(25)
  let lateFeeApr = interestAprAsBN(0)
  let paymentPeriodInDays = new BN(1)
  let termInDays = new BN(365)

  const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    // Just to be crystal clear
    const {protocol_owner} = await getNamedAccounts()
    owner = protocol_owner

    const {pool, usdc, fidu, creditDesk, goldfinchConfig} = await deployAllContracts(deployments)
    // A bit of setup for our test users
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, borrower])
    await goldfinchConfig.bulkAddToGoList([owner, underwriter, borrower])
    await pool.deposit(String(usdcVal(10000)), {from: owner})
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(25000), {from: owner})
    return {usdc, pool, fidu, goldfinchConfig, creditDesk}
  })

  async function createCreditLine({
    _paymentPeriodInDays,
    _borrower,
    _limit,
    _interestApr,
    _termInDays,
    _lateFeesApr,
  } = {}) {
    await creditDesk.createCreditLine(
      borrower || _borrower,
      limit || _limit,
      interestApr || _interestApr,
      _paymentPeriodInDays || paymentPeriodInDays,
      termInDays || _termInDays,
      lateFeeApr || _lateFeesApr,
      {from: underwriter}
    )
    var ulCreditLines = await creditDesk.getUnderwriterCreditLines(underwriter)
    return CreditLine.at(ulCreditLines[0])
  }

  async function advanceToTimestamp(timestamp) {
    fakeTimestamp = timestamp
    await advanceTime(creditDesk, {toSecond: fakeTimestamp})
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower] = accounts
    ;({creditDesk} = await setupTest())

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
      creditLine = await createCreditLine()

      await creditDesk.drawdown(creditLine.address, usdcVal(10), {from: borrower})
      // Advance to just beyond the nextDueTime
      await advanceToTimestamp((await creditLine.nextDueTime()).add(new BN(10)))
      await expectAction(() => assessIfRequired(creditDesk, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {increase: true}],
      ])
    })

    it("does not assess if within the nextDueTime", async () => {
      creditLine = await createCreditLine()

      await creditDesk.drawdown(creditLine.address, usdcVal(10), {from: borrower})

      // Advance to just before the next due block
      await advanceToTimestamp((await creditLine.nextDueTime()).sub(new BN(10)))

      await expectAction(() => assessIfRequired(creditDesk, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {by: 0}],
      ])
    })

    it("assesses if beyond the term end block", async () => {
      creditLine = await createCreditLine()

      await creditDesk.drawdown(creditLine.address, usdcVal(10), {from: borrower})

      // Advance to just after the term due block
      await advanceToTimestamp((await creditLine.termEndTime()).add(new BN(10)))

      await expectAction(() => assessIfRequired(creditDesk, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {increase: true}],
      ])
    })

    it("does not assess if no balance", async () => {
      creditLine = await createCreditLine()

      await expectAction(() => assessIfRequired(creditDesk, creditLine, fakeProvider)).toChange([
        [creditLine.nextDueTime, {by: 0}],
      ])
    })
  })
})

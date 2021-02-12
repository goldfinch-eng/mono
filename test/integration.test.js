/* global artifacts web3 */
const hre = require("hardhat")
const {deployments} = hre
const {
  expect,
  BN,
  usdcVal,
  getBalance,
  deployAllContracts,
  erc20Approve,
  erc20Transfer,
  BLOCKS_PER_DAY,
  BLOCKS_PER_YEAR,
  usdcToFidu,
  expectAction,
  fiduToUSDC,
  advanceTime,
} = require("./testHelpers.js")
const {interestAprAsBN, INTEREST_DECIMALS, ETHDecimals, CONFIG_KEYS} = require("../blockchain_scripts/deployHelpers")
const {time} = require("@openzeppelin/test-helpers")
const CreditLine = artifacts.require("CreditLine")

// eslint-disable-next-line no-unused-vars
let accounts, owner, underwriter, borrower, investor1, investor2
let creditDesk, fidu, goldfinchConfig, reserve, usdc, pool, creditLine

describe("Goldfinch", async () => {
  let limit = usdcVal(10000)
  let interestApr = interestAprAsBN(25)
  let lateFeeApr = interestAprAsBN(0)
  let paymentPeriodInDays = new BN(1)
  let termInDays = new BN(365)
  let paymentPeriodInBlocks = BLOCKS_PER_DAY.mul(paymentPeriodInDays)

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {pool, usdc, creditDesk, fidu, goldfinchConfig} = await deployAllContracts(deployments)

    // Approve transfers for our test accounts
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, underwriter, borrower, investor1, investor2])
    // Some housekeeping so we have a usable creditDesk for tests, and a pool with funds
    await erc20Transfer(usdc, [underwriter, investor1, investor2], usdcVal(100000), owner)
    await pool.deposit(String(usdcVal(10000)), {from: underwriter})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(25000), {from: owner})
    return {pool, usdc, creditDesk, fidu, goldfinchConfig}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower, investor1, investor2, reserve] = accounts
    ;({usdc, pool, creditDesk, fidu, goldfinchConfig} = await setupTest())
  })

  describe("functional test", async () => {
    async function assertCreditLine(
      balance,
      interestOwed,
      collectedPayment,
      nextDueBlock,
      interestAccruedAsOfBlock,
      lastFullPaymentBlock
    ) {
      expect(await creditLine.balance()).to.bignumber.equal(balance)
      expect(await creditLine.interestOwed()).to.bignumber.equal(interestOwed)
      expect(await creditLine.principalOwed()).to.bignumber.equal("0") // Principal owed is always 0
      expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal(collectedPayment)
      expect(await creditLine.nextDueBlock()).to.bignumber.equal(new BN(nextDueBlock))
      expect(await creditLine.interestAccruedAsOfBlock()).to.bignumber.equal(new BN(interestAccruedAsOfBlock))
      expect(await creditLine.lastFullPaymentBlock()).to.bignumber.equal(new BN(lastFullPaymentBlock))
    }

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

    async function deposit(amount, investor) {
      investor = investor || investor1
      await pool.deposit(amount, {from: investor})
    }

    async function drawdown(clAddress, amount, _borrower) {
      _borrower = _borrower || borrower
      await creditDesk.drawdown(clAddress, amount, {from: _borrower})
    }

    async function makePayment(clAddress, amount, _borrower) {
      _borrower = _borrower || borrower
      await creditDesk.pay(clAddress, amount, {from: _borrower})
    }

    async function calculateInvestorInterest(cl, timeInDays) {
      const numBlocks = timeInDays.mul(BLOCKS_PER_DAY)
      const totalInterestPerYear = (await cl.balance()).mul(await cl.interestApr()).div(INTEREST_DECIMALS)
      const totalExpectedInterest = totalInterestPerYear.mul(numBlocks).div(BLOCKS_PER_YEAR)
      const reserveDenominator = await goldfinchConfig.getNumber(CONFIG_KEYS.ReserveDenominator)
      return totalExpectedInterest.sub(totalExpectedInterest.div(reserveDenominator))
    }

    function assessCreditLine(clAddress) {
      return creditDesk.assessCreditLine(clAddress)
    }

    async function afterWithdrawalFees(grossAmount) {
      const feeDenominator = await goldfinchConfig.getNumber(CONFIG_KEYS.WithdrawFeeDenominator)
      return grossAmount.sub(grossAmount.div(feeDenominator))
    }

    async function withdraw(usdcAmount, investor) {
      investor = investor || investor1
      if (usdcAmount === "max") {
        const numShares = await getBalance(investor, fidu)
        const maxAmount = (await pool.sharePrice()).mul(numShares)
        usdcAmount = fiduToUSDC(maxAmount.div(ETHDecimals))
      }
      return pool.withdraw(usdcAmount, {from: investor})
    }

    async function withdrawInFidu(fiduAmount, investor) {
      return pool.withdrawInFidu(fiduAmount, {from: investor})
    }

    async function doAllMainActions(clAddress) {
      await deposit(new BN(10))
      await withdraw(new BN(10))
      await drawdown(clAddress, new BN(10))
      await makePayment(clAddress, new BN(10))
    }

    describe("scenarios", async () => {
      it("should accrue interest with multiple investors", async () => {
        let amount = usdcVal(10000)
        let drawdownAmount = amount.div(new BN(10))
        await expectAction(async () => {
          await deposit(amount)
          await deposit(amount, investor2)
        }).toChange([
          [async () => await getBalance(investor1, fidu), {by: usdcToFidu(amount)}],
          [async () => await getBalance(investor2, fidu), {by: usdcToFidu(amount)}],
        ])
        const paymentPeriodInDays = new BN(15)
        const creditLine = await createCreditLine({_paymentPeriodInDays: paymentPeriodInDays})

        await drawdown(creditLine.address, drawdownAmount, borrower)
        const expectedInterest = await calculateInvestorInterest(creditLine, paymentPeriodInDays)

        await advanceTime(creditDesk, {days: 10})
        // Just a hack to get interestOwed and other accounting vars to update
        await drawdown(creditLine.address, new BN(1), borrower)

        // Pay more than you need, to definitely pay all the interest
        // Early payments shouldn't affect share price
        await expectAction(() => makePayment(creditLine.address, drawdownAmount)).toChange([
          [pool.sharePrice, {by: new BN(0)}],
        ])
        await advanceTime(creditDesk, {days: 5})

        await expectAction(() => assessCreditLine(creditLine.address)).toChange([
          [pool.sharePrice, {increase: true}],
          [creditLine.interestOwed, {decrease: true}],
        ])

        // There was 10k already in the pool, so each investor has a third
        const grossExpectedReturn = amount.add(expectedInterest.div(new BN(3)))
        const expectedReturn = await afterWithdrawalFees(grossExpectedReturn)
        const availableFidu = await getBalance(investor2, fidu)
        await expectAction(async () => {
          await withdraw("max")
          await withdrawInFidu(availableFidu, investor2) // Withdraw everything in fidu terms
        }).toChange([
          [() => getBalance(investor1, usdc), {by: expectedReturn}],
          [() => getBalance(investor2, usdc), {by: expectedReturn}], // Also ensures share price is correctly incorporated
        ])

        await doAllMainActions(creditLine.address)
      })

      it("should handle writedowns correctly", async () => {
        let amount = usdcVal(10000)
        let drawdownAmount = amount.div(new BN(2))

        await deposit(amount)
        await deposit(amount, investor2)
        const creditLine = await createCreditLine({_paymentPeriodInDays: paymentPeriodInDays})
        await drawdown(creditLine.address, drawdownAmount, borrower)

        // Advance to a point where we would definitely writethem down
        const fourPeriods = (await creditLine.paymentPeriodInDays()).mul(new BN(4))
        await advanceTime(creditDesk, {days: fourPeriods.toNumber()})

        await expectAction(() => assessCreditLine(creditLine.address)).toChange([
          [creditDesk.totalWritedowns, {increase: true}],
          [creditLine.interestOwed, {increase: true}],
          [pool.sharePrice, {decrease: true}],
        ])

        // All the main actions should still work as expected!
        await expect(drawdown(creditLine.address, new BN(10))).to.be.rejected
        await deposit(new BN(10))
        await withdraw(new BN(10))
        await makePayment(creditLine.address, new BN(10))
      })

      // This test fails now, but should pass once we fix late fee logic.
      // We *should* charge interest after term end block, when you're so late that
      // you're past the grace period. But currently we don't charge any.
      xit("should accrue interest correctly after the term end block", async () => {
        let amount = usdcVal(10000)
        let drawdownAmount = amount.div(new BN(2))

        await deposit(amount)
        await deposit(amount, investor2)
        const creditLine = await createCreditLine({
          _paymentPeriodInDays: paymentPeriodInDays,
          lateFeeApr: interestAprAsBN("3.0"),
        })
        await drawdown(creditLine.address, drawdownAmount, borrower)

        // Advance to a point where we would definitely writethem down
        const termLength = await creditLine.termInDays()
        await advanceTime(creditDesk, {days: termLength.toNumber()})

        await assessCreditLine(creditLine.address)

        const termInterestTotalWithLateFees = drawdownAmount.mul(interestApr.add(lateFeeApr)).div(INTEREST_DECIMALS)
        expect(await creditLine.interestOwed()).to.bignumber.equal(termInterestTotalWithLateFees)

        // advance more time
        const clPaymentPeriodInDays = await creditLine.paymentPeriodInDays()
        await advanceTime(creditDesk, {days: clPaymentPeriodInDays.toNumber()})

        await assessCreditLine(creditLine.address)
        expect(await creditLine.interestOwed()).to.bignumber.gt(termInterestTotalWithLateFees)
      })
    })

    describe("credit lines and interest rates", async () => {
      beforeEach(async () => {
        limit = usdcVal(10000)
        interestApr = interestAprAsBN(25)
        lateFeeApr = interestAprAsBN(0)
        paymentPeriodInDays = new BN(1)
        termInDays = new BN(365)
        paymentPeriodInBlocks = BLOCKS_PER_DAY.mul(paymentPeriodInDays)
      })

      describe("drawdown and isLate", async () => {
        it("should not think you're late if it's not past the nextDueBlock", async () => {
          creditLine = await createCreditLine({_paymentPeriodInDays: new BN(30)})
          await expect(drawdown(creditLine.address, new BN(1000))).to.be.fulfilled
          await advanceTime(creditDesk, {days: 10})
          // This drawdown will accumulate and record some interest
          await expect(drawdown(creditLine.address, new BN(1))).to.be.fulfilled
          // This one should still work, because you still aren't late...
          await expect(drawdown(creditLine.address, new BN(1))).to.be.fulfilled
        })
      })

      it("calculates interest correctly", async () => {
        let currentBlock = await advanceTime(creditDesk, {days: 1})
        creditLine = await createCreditLine()

        let interestAccruedAsOfBlock = await time.latestBlock()
        await assertCreditLine("0", "0", "0", 0, interestAccruedAsOfBlock, 0)

        currentBlock = await advanceTime(creditDesk, {days: 1})
        await drawdown(creditLine.address, usdcVal(2000))

        var nextDueBlock = (await creditDesk.blockNumberForTest()).add(BLOCKS_PER_DAY.mul(paymentPeriodInDays))
        interestAccruedAsOfBlock = currentBlock
        let lastFullPaymentBlock = currentBlock
        await assertCreditLine(usdcVal(2000), "0", "0", nextDueBlock, currentBlock, lastFullPaymentBlock)

        currentBlock = await advanceTime(creditDesk, {days: 1})

        await creditDesk.assessCreditLine(creditLine.address, {from: borrower})

        const totalInterestPerYear = usdcVal(2000).mul(interestApr).div(INTEREST_DECIMALS)
        let blocksPassed = nextDueBlock.sub(interestAccruedAsOfBlock)
        let expectedInterest = totalInterestPerYear.mul(blocksPassed).div(BLOCKS_PER_YEAR)
        nextDueBlock = nextDueBlock.add(paymentPeriodInBlocks)

        expect(expectedInterest).to.bignumber.eq("1369863")

        await assertCreditLine(
          usdcVal(2000),
          expectedInterest,
          "0",
          nextDueBlock,
          nextDueBlock.sub(paymentPeriodInBlocks),
          lastFullPaymentBlock
        )

        currentBlock = await advanceTime(creditDesk, {days: 1})
        expectedInterest = expectedInterest.mul(new BN(2)) // 2 days of interest
        nextDueBlock = nextDueBlock.add(paymentPeriodInBlocks)

        await creditDesk.assessCreditLine(creditLine.address, {from: borrower})

        await assertCreditLine(
          usdcVal(2000),
          expectedInterest,
          "0",
          nextDueBlock,
          nextDueBlock.sub(paymentPeriodInBlocks),
          lastFullPaymentBlock
        )
      })
    })
  })
})

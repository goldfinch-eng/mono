/* global artifacts web3 */
const hre = require("hardhat")
const {deployments} = hre
const {
  expect,
  decimals,
  BN,
  usdcVal,
  getBalance,
  getDeployedAsTruffleContract,
  BLOCKS_PER_DAY,
  BLOCKS_PER_YEAR,
  usdcToFidu,
  expectAction,
  fiduToUSDC,
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
    await deployments.fixture("base_deploy")
    pool = await getDeployedAsTruffleContract(deployments, "Pool")
    usdc = await getDeployedAsTruffleContract(deployments, "ERC20")
    creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
    fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
    goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")

    // Approve transfers for our test accounts
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: owner})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: underwriter})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: borrower})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: investor1})
    await usdc.approve(pool.address, new BN(100000).mul(decimals), {from: investor2})

    // Some housekeeping so we have a usable creditDesk for tests, and a pool with funds
    await usdc.transfer(underwriter, String(usdcVal(100000)), {from: owner})
    await usdc.transfer(investor1, String(usdcVal(100000)), {from: owner})
    await usdc.transfer(investor2, String(usdcVal(100000)), {from: owner})
    await pool.deposit(String(usdcVal(10000)), {from: underwriter})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(25000), {from: owner})
    return {pool, usdc, creditDesk, fidu, goldfinchConfig}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower, investor1, investor2, reserve] = accounts
    const deployResult = await setupTest()

    usdc = deployResult.usdc
    pool = deployResult.pool
    creditDesk = deployResult.creditDesk
    fidu = deployResult.fidu
    goldfinchConfig = deployResult.goldfinchConfig
  })

  describe("functional test", async () => {
    async function advanceTime({days, blocks, toBlock}) {
      let blocksPassed, newBlock
      let currentBlock = await creditDesk.blockNumberForTest()

      if (days) {
        blocksPassed = BLOCKS_PER_DAY.mul(new BN(days))
        newBlock = currentBlock.add(blocksPassed)
      } else if (blocks) {
        blocksPassed = new BN(blocks)
        newBlock = currentBlock.add(blocksPassed)
      } else if (toBlock) {
        newBlock = new BN(toBlock)
      }
      // Cannot go backward
      expect(newBlock).to.bignumber.gt(currentBlock)
      await creditDesk._setBlockNumberForTest(newBlock)
      return newBlock
    }

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
      await creditDesk.drawdown(amount, clAddress, _borrower, {from: _borrower})
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

    async function withdraw(amount, investor) {
      investor = investor || investor1
      if (amount === "max") {
        const numShares = await getBalance(investor, fidu)
        const maxAmount = (await pool.sharePrice()).mul(numShares)
        amount = fiduToUSDC(maxAmount.div(ETHDecimals))
      }
      return pool.withdraw(amount, {from: investor})
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

        await advanceTime({days: 10})
        // Just a hack to get interestOwed and other accounting vars to update
        await drawdown(creditLine.address, new BN(1), borrower)

        // Pay more than you need, to definitely pay all the interest
        // Early payments shouldn't affect share price
        await expectAction(() => makePayment(creditLine.address, drawdownAmount)).toChange([
          [pool.sharePrice, {by: new BN(0)}],
        ])
        await advanceTime({days: 5})

        await expectAction(() => assessCreditLine(creditLine.address)).toChange([
          [pool.sharePrice, {increase: true}],
          [creditLine.interestOwed, {decrease: true}],
        ])

        // There was 10k already in the pool, so each investor has a third
        const grossExpectedReturn = amount.add(expectedInterest.div(new BN(3)))
        const expectedReturn = await afterWithdrawalFees(grossExpectedReturn)

        await expectAction(async () => {
          await withdraw("max")
          await withdraw("max", investor2)
        }).toChange([
          [() => getBalance(investor1, usdc), {by: expectedReturn}],
          [() => getBalance(investor2, usdc), {by: expectedReturn}],
        ])

        await doAllMainActions(creditLine.address)
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
          await expect(creditDesk.drawdown(new BN(1000), creditLine.address, borrower, {from: borrower})).to.be
            .fulfilled
          await advanceTime({days: 10})
          // This drawdown will accumulate and record some interest
          await expect(creditDesk.drawdown(new BN(1), creditLine.address, borrower, {from: borrower})).to.be.fulfilled
          // This one should still work, because you still aren't late...
          await expect(creditDesk.drawdown(new BN(1), creditLine.address, borrower, {from: borrower})).to.be.fulfilled
        })
      })

      it("calculates interest correctly", async () => {
        let currentBlock = await advanceTime({days: 1})
        creditLine = await createCreditLine()

        let interestAccruedAsOfBlock = await time.latestBlock()
        await assertCreditLine("0", "0", "0", 0, interestAccruedAsOfBlock, 0)

        currentBlock = await advanceTime({days: 1})
        await creditDesk.drawdown(usdcVal(2000), creditLine.address, borrower, {from: borrower})

        var nextDueBlock = (await creditDesk.blockNumberForTest()).add(BLOCKS_PER_DAY.mul(paymentPeriodInDays))
        interestAccruedAsOfBlock = currentBlock
        let lastFullPaymentBlock = currentBlock
        await assertCreditLine(usdcVal(2000), "0", "0", nextDueBlock, currentBlock, lastFullPaymentBlock)

        currentBlock = await advanceTime({days: 1})

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

        currentBlock = await advanceTime({days: 1})
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

import hre from "hardhat"
const {deployments, web3} = hre
import {
  expect,
  BN,
  usdcVal,
  getBalance,
  erc20Approve,
  erc20Transfer,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR,
  usdcToFidu,
  expectAction,
  advanceTime,
  Numberish,
  bigVal,
  ZERO,
} from "./testHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {
  TRANCHES,
  interestAprAsBN,
  INTEREST_DECIMALS,
  MAX_UINT,
  POOL_VERSION1,
  POOL_VERSION2,
} from "../blockchain_scripts/deployHelpers"
import {time} from "@openzeppelin/test-helpers"
import {
  deployBaseFixture,
  deployTranchedPoolWithGoldfinchFactoryFixture,
  getContractsFromPoolVersion,
} from "./util/fixtures"
import {STAKING_REWARDS_PARAMS} from "../blockchain_scripts/migrations/v2.2/deploy"

// eslint-disable-next-line no-unused-vars
let accounts, owner, underwriter, borrower, investor1, investor2
let fidu, goldfinchConfig, reserve, usdc, seniorPool, creditLine, tranchedPool, goldfinchFactory, poolTokens

const ONE_HUNDRED = new BN(100)

const TEST_TIMEOUT = 60000

describe("Goldfinch", async function () {
  this.timeout(TEST_TIMEOUT)

  let limit = usdcVal(10000)
  let interestApr = interestAprAsBN("25")
  let lateFeeApr = interestAprAsBN("0")
  const juniorFeePercent = new BN(20)
  const allowedUIDTypes = [0]
  let paymentPeriodInDays = new BN(1)
  let termInDays = new BN(365)
  const principalGracePeriod = new BN(185)
  const fundableAt = new BN(0)
  let paymentPeriodInSeconds = SECONDS_PER_DAY.mul(paymentPeriodInDays)

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {seniorPool, usdc, fidu, goldfinchConfig, goldfinchFactory, poolTokens, stakingRewards, gfi} =
      await deployBaseFixture()

    // Approve transfers for our test accounts
    await erc20Approve(usdc, seniorPool.address, usdcVal(100000), [owner, underwriter, borrower, investor1, investor2])
    // Some housekeeping so we have a usable setup for tests
    await erc20Transfer(usdc, [underwriter, investor1, investor2], usdcVal(100000), owner)
    // Add all web3 accounts to the GoList
    await goldfinchConfig.bulkAddToGoList(accounts)

    const gfiToLoadIntoStakingRewards = bigVal(1_000_000)
    await gfi.mint(owner, gfiToLoadIntoStakingRewards)
    await erc20Approve(gfi, stakingRewards.address, MAX_UINT, [owner])
    await erc20Approve(usdc, stakingRewards.address, MAX_UINT, [owner])
    await stakingRewards.loadRewards(gfiToLoadIntoStakingRewards)
    await stakingRewards.setRewardsParameters(
      STAKING_REWARDS_PARAMS.targetCapacity.toString(),
      STAKING_REWARDS_PARAMS.minRate.toString(),
      STAKING_REWARDS_PARAMS.maxRate.toString(),
      STAKING_REWARDS_PARAMS.minRateAtPercent.toString(),
      STAKING_REWARDS_PARAMS.maxRateAtPercent.toString()
    )
    await stakingRewards.depositAndStake(usdcVal(5000), {from: owner})
    await stakingRewards.kick(0)

    await seniorPool.deposit(String(usdcVal(10000)), {from: underwriter})
    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    return {seniorPool, usdc, fidu, goldfinchConfig, goldfinchFactory, poolTokens, stakingRewards, gfi}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower, investor1, investor2, reserve] = accounts
    ;({usdc, seniorPool, fidu, goldfinchConfig, goldfinchFactory, poolTokens} = await setupTest())
  })

  describe("functional test", async () => {
    async function assertCreditLine(
      balance,
      interestOwed,
      collectedPayment,
      nextDueTime,
      interestAccruedAsOf,
      lastFullPaymentTime
    ) {
      expect(await creditLine.balance()).to.bignumber.equal(balance)
      expect(await creditLine.interestOwed()).to.bignumber.equal(interestOwed)
      expect(await creditLine.principalOwed()).to.bignumber.equal("0") // Principal owed is always 0
      expect(await getBalance(creditLine.address, usdc)).to.bignumber.equal(collectedPayment)
      expect(await creditLine.nextDueTime()).to.bignumber.equal(new BN(nextDueTime))
      expect(await creditLine.interestAccruedAsOf()).to.bignumber.equal(new BN(interestAccruedAsOf))
      expect(await creditLine.lastFullPaymentTime()).to.bignumber.equal(new BN(lastFullPaymentTime))
    }

    async function createPool(
      {
        _paymentPeriodInDays,
        _borrower,
        _limit,
        _interestApr,
        _termInDays,
        _lateFeesApr,
        _allowedUIDTypes,
      }: {
        _paymentPeriodInDays?: Numberish
        _borrower?: string
        _limit?: Numberish
        _interestApr?: Numberish
        _termInDays?: Numberish
        _lateFeesApr?: Numberish
        _allowedUIDTypes?: Array<Numberish>
      } = {},
      version: string
    ) {
      const deployments = await deployTranchedPoolWithGoldfinchFactoryFixture(`integration ${version}`)({
        usdcAddress: usdc.address,
        borrower: borrower || _borrower,
        juniorFeePercent,
        limit: limit || _limit,
        interestApr: interestApr || _interestApr,
        paymentPeriodInDays: _paymentPeriodInDays || paymentPeriodInDays,
        termInDays: termInDays || _termInDays,
        lateFeeApr: lateFeeApr || _lateFeesApr,
        principalGracePeriodInDays: principalGracePeriod,
        fundableAt: fundableAt,
        allowedUIDTypes: allowedUIDTypes || _allowedUIDTypes,
        version,
      })

      ;({tranchedPool, creditLine} = await getContractsFromPoolVersion(
        deployments.poolAddress,
        deployments.clAddress,
        version
      ))

      await erc20Approve(usdc, tranchedPool.address, MAX_UINT, [owner, borrower, investor1, investor2])
      return {tranchedPool, creditLine}
    }

    async function depositToSeniorPool(amount, investor?) {
      investor = investor || investor1
      await seniorPool.deposit(amount, {from: investor})
    }

    async function requestWithdrawalFromSeniorPool(amount, investor) {
      await erc20Approve(fidu, seniorPool.address, amount, [investor])
      await seniorPool.requestWithdrawal(amount, {from: investor})
    }

    async function withdrawFromSeniorPool(tokenId, investor) {
      await seniorPool.claimWithdrawalRequest(tokenId, {from: investor})
    }

    async function depositToPool(pool, amount, investor?, tranche?) {
      investor = investor || investor1
      tranche = tranche || TRANCHES.Junior
      await pool.deposit(tranche, amount, {from: investor})
    }

    async function lockAndLeveragePool(pool) {
      await pool.lockJuniorCapital({from: borrower})
      await seniorPool.invest(pool.address)
    }

    async function drawdown(pool, amount, _borrower?) {
      _borrower = _borrower || borrower
      await pool.drawdown(amount, {from: _borrower})
    }

    async function makePayment(pool, amount, _borrower?) {
      _borrower = _borrower || borrower
      await pool.pay(amount, {from: _borrower})
    }

    function getPercent(number, percent) {
      return number.mul(percent).div(ONE_HUNDRED)
    }

    async function calculateInterest(pool, cl, timeInDays, tranche) {
      const numSeconds = timeInDays.mul(SECONDS_PER_DAY)
      const totalInterestPerYear = (await cl.balance()).mul(await cl.interestApr()).div(INTEREST_DECIMALS)
      const totalExpectedInterest = totalInterestPerYear.mul(numSeconds).div(SECONDS_PER_YEAR)
      if (tranche === null) {
        return totalExpectedInterest
      }
      // To get the senior interest, first we need to scale by levarage ratio
      const juniorTotal = new BN((await pool.getTranche(TRANCHES.Junior)).principalDeposited)
      const seniorTotal = new BN((await pool.getTranche(TRANCHES.Senior)).principalDeposited)
      const seniorLeveragePercent = ONE_HUNDRED.mul(seniorTotal).div(seniorTotal.add(juniorTotal))
      const reserveFeePercent = ONE_HUNDRED.div(await goldfinchConfig.getNumber(CONFIG_KEYS.ReserveDenominator))
      const seniorInterest = totalExpectedInterest.mul(seniorLeveragePercent).div(ONE_HUNDRED)

      if (tranche === TRANCHES.Senior) {
        const seniorFractionNetFees = ONE_HUNDRED.sub(reserveFeePercent).sub(juniorFeePercent)
        return getPercent(seniorInterest, seniorFractionNetFees)
      } else if (tranche === TRANCHES.Junior) {
        const juniorLeveragePercent = ONE_HUNDRED.mul(juniorTotal).div(seniorTotal.add(juniorTotal))
        let juniorInterest = getPercent(totalExpectedInterest, juniorLeveragePercent)
        // Subtract fees
        juniorInterest = getPercent(juniorInterest, ONE_HUNDRED.sub(reserveFeePercent))
        // Add junior fee
        const juniorFee = getPercent(seniorInterest, juniorFeePercent)
        return juniorInterest.add(juniorFee)
      }
    }

    async function getPoolTokenFor(owner, index?) {
      return poolTokens.tokenOfOwnerByIndex(owner, index || 0)
    }

    async function assessPool(pool) {
      await pool.assess()
      const tokenId = await getPoolTokenFor(seniorPool.address)
      await seniorPool.redeem(tokenId)
      await seniorPool.writedown(tokenId)
    }

    async function checkpointPool(creditLine) {
      await creditLine._checkpoint()
      const tokenId = await getPoolTokenFor(seniorPool.address)
      await seniorPool.redeem(tokenId)
      await seniorPool.writedown(tokenId)
    }

    async function afterWithdrawalFees(grossAmount) {
      const feeDenominator = await goldfinchConfig.getNumber(CONFIG_KEYS.WithdrawFeeDenominator)
      return grossAmount.sub(grossAmount.div(feeDenominator))
    }

    async function withdrawFromPool(pool, usdcAmount, investor?) {
      investor = investor || investor1
      const tokenId = await getPoolTokenFor(investor)
      if (usdcAmount === "max") {
        return pool.withdrawMax(tokenId, {from: investor})
      } else {
        return pool.withdraw(tokenId, usdcAmount, {from: investor})
      }
    }

    /*
    Although the tests for v1 and v2 are very similar, they are distinct enough that it's not
    feasible to loop through the tests and simply swap out the pool version.
    */

    describe(`TranchedPool ${POOL_VERSION1}`, () => {
      describe("scenarios", async () => {
        it("should accrue interest with multiple investors", async () => {
          const amount = usdcVal(10000)
          const juniorAmount = usdcVal(1000)
          const drawdownAmount = amount.div(new BN(10))
          const paymentPeriodInDays = new BN(15)

          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({tranchedPool, creditLine} = await createPool({_paymentPeriodInDays: paymentPeriodInDays}, POOL_VERSION1))

          await expectAction(async () => {
            await depositToSeniorPool(amount)
            await depositToSeniorPool(amount, investor2)
            await depositToPool(tranchedPool, juniorAmount)
            await depositToPool(tranchedPool, juniorAmount, investor2)
          }).toChange([
            [async () => await getBalance(investor1, fidu), {by: usdcToFidu(amount)}],
            [async () => await getBalance(investor2, fidu), {by: usdcToFidu(amount)}],
            [async () => await getBalance(investor1, poolTokens), {by: new BN(1)}],
            [async () => await getBalance(investor2, poolTokens), {by: new BN(1)}],
          ])

          // Investors request to withdraw
          await requestWithdrawalFromSeniorPool(usdcToFidu(amount), investor1)
          await requestWithdrawalFromSeniorPool(usdcToFidu(amount), investor2)

          await lockAndLeveragePool(tranchedPool)
          await drawdown(tranchedPool, drawdownAmount, borrower)
          const totalInterest = await calculateInterest(tranchedPool, creditLine, paymentPeriodInDays, null)
          const expectedSeniorInterest = await calculateInterest(
            tranchedPool,
            creditLine,
            paymentPeriodInDays,
            TRANCHES.Senior
          )
          const expectedJuniorInterest = await calculateInterest(
            tranchedPool,
            creditLine,
            paymentPeriodInDays,
            TRANCHES.Junior
          )

          await advanceTime({days: 10})
          // Just a hack to get interestOwed and other accounting vars to update
          await drawdown(tranchedPool, new BN(1), borrower)

          await expectAction(() => makePayment(tranchedPool, totalInterest)).toChange([
            [seniorPool.sharePrice, {by: new BN(0)}],
          ])
          await advanceTime({days: 5})

          await expectAction(() => assessPool(tranchedPool)).toChange([
            [seniorPool.sharePrice, {increase: true}],
            [creditLine.interestOwed, {to: new BN(0)}],
          ])

          // There was 10k already in the pool, so each investor has a third
          const grossExpectedReturn = amount.add(expectedSeniorInterest.div(new BN(3)))
          const expectedReturn = await afterWithdrawalFees(grossExpectedReturn)
          await expectAction(async () => {
            await withdrawFromSeniorPool(1, investor1)
            await withdrawFromSeniorPool(2, investor2)
          }).toChange([
            [() => getBalance(investor1, usdc), {byCloseTo: expectedReturn}],
            [() => getBalance(investor2, usdc), {byCloseTo: expectedReturn}], // Also ensures share price is correctly incorporated
          ])

          // Only 2 junior investors, and both were for the same amount. 10% was drawdown, so 90% of junior principal is redeemable
          const principalFractionUsed = (await creditLine.balance()).mul(ONE_HUNDRED).div(limit)
          const juniorPrincipalAvailable = getPercent(juniorAmount, ONE_HUNDRED.sub(principalFractionUsed))
          const expectedJuniorReturn = juniorPrincipalAvailable.add(expectedJuniorInterest.div(new BN(2)))
          await expectAction(async () => {
            await withdrawFromPool(tranchedPool, "max")
            await withdrawFromPool(tranchedPool, expectedJuniorReturn, investor2)
          }).toChange([
            [() => getBalance(investor1, usdc), {byCloseTo: expectedJuniorReturn}],
            [() => getBalance(investor2, usdc), {byCloseTo: expectedJuniorReturn}],
          ])
        })

        it("should handle writedowns correctly", async () => {
          const amount = usdcVal(10000)
          const juniorAmount = usdcVal(1000)
          const drawdownAmount = amount.div(new BN(2))

          await depositToSeniorPool(amount)
          await requestWithdrawalFromSeniorPool(usdcToFidu(amount), investor1)

          await depositToSeniorPool(amount, investor2)
          await createPool({_paymentPeriodInDays: paymentPeriodInDays}, POOL_VERSION1)
          await depositToPool(tranchedPool, juniorAmount)
          await depositToPool(tranchedPool, juniorAmount, investor2)
          await lockAndLeveragePool(tranchedPool)
          await drawdown(tranchedPool, drawdownAmount, borrower)

          await goldfinchConfig.setNumber(CONFIG_KEYS.LatenessGracePeriodInDays, paymentPeriodInDays)
          // Advance to a point where we would definitely write them down
          const fourPeriods = (await creditLine.paymentPeriodInDays()).mul(new BN(4))
          await advanceTime({days: fourPeriods.toNumber()})

          await expectAction(() => assessPool(tranchedPool)).toChange([
            [seniorPool.totalWritedowns, {increase: true}],
            [creditLine.interestOwed, {increase: true}],
            [seniorPool.sharePrice, {decrease: true}],
          ])

          // All the main actions should still work as expected!
          await expect(drawdown(tranchedPool, new BN(10))).to.be.rejected
          await depositToSeniorPool(new BN(10))
          await withdrawFromSeniorPool(1, investor1)
          await makePayment(tranchedPool, new BN(10))
        })
      })

      describe("credit lines and interest rates", async () => {
        beforeEach(async () => {
          limit = usdcVal(10000)
          interestApr = interestAprAsBN("25")
          lateFeeApr = interestAprAsBN("0")
          paymentPeriodInDays = new BN(1)
          termInDays = new BN(365)
          paymentPeriodInSeconds = SECONDS_PER_DAY.mul(paymentPeriodInDays)
        })

        describe("drawdown and isLate", async () => {
          it("should not think you're late if it's not past the nextDueTime", async () => {
            await createPool({_paymentPeriodInDays: new BN(30)}, POOL_VERSION1)
            await depositToPool(tranchedPool, usdcVal(200))
            await lockAndLeveragePool(tranchedPool)
            await expect(drawdown(tranchedPool, new BN(1000))).to.be.fulfilled
            await advanceTime({days: 10})
            // This drawdown will accumulate and record some interest
            await expect(drawdown(tranchedPool, new BN(1))).to.be.fulfilled
            // This one should still work, because you still aren't late...
            await expect(drawdown(tranchedPool, new BN(1))).to.be.fulfilled
          })
        })

        it("calculates interest correctly", async () => {
          let currentTime = await advanceTime({days: 1})
          await createPool({}, POOL_VERSION1)
          // Subtract 6 to account for additional blocks mined in createV1Pool
          // after the block that initialized the credit line
          let interestAccruedAsOf = (await time.latest()).sub(new BN(6))
          await depositToPool(tranchedPool, usdcVal(2000))
          await lockAndLeveragePool(tranchedPool)

          await assertCreditLine("0", "0", "0", 0, interestAccruedAsOf, 0)

          currentTime = await advanceTime({days: 1})
          await drawdown(tranchedPool, usdcVal(2000))

          let nextDueTime = (await time.latest()).add(SECONDS_PER_DAY.mul(paymentPeriodInDays))
          interestAccruedAsOf = currentTime
          const lastFullPaymentTime = currentTime
          await assertCreditLine(usdcVal(2000), "0", "0", nextDueTime, currentTime, lastFullPaymentTime)

          currentTime = await advanceTime({days: 1})

          await tranchedPool.assess({from: borrower})

          const totalInterestPerYear = usdcVal(2000).mul(interestApr).div(INTEREST_DECIMALS)
          const secondsPassed = nextDueTime.sub(interestAccruedAsOf)
          let expectedInterest = totalInterestPerYear.mul(secondsPassed).div(SECONDS_PER_YEAR)
          nextDueTime = nextDueTime.add(paymentPeriodInSeconds)

          expect(expectedInterest).to.bignumber.eq("1369863")

          await assertCreditLine(
            usdcVal(2000),
            expectedInterest,
            "0",
            nextDueTime,
            nextDueTime.sub(paymentPeriodInSeconds),
            lastFullPaymentTime
          )

          currentTime = await advanceTime({days: 1})
          expectedInterest = expectedInterest.mul(new BN(2)) // 2 days of interest
          nextDueTime = nextDueTime.add(paymentPeriodInSeconds)

          await tranchedPool.assess({from: borrower})

          await assertCreditLine(
            usdcVal(2000),
            expectedInterest,
            "0",
            nextDueTime,
            nextDueTime.sub(paymentPeriodInSeconds),
            lastFullPaymentTime
          )
        })
      })
    })

    describe(`TranchedPool ${POOL_VERSION2}`, () => {
      describe("scenarios", () => {
        /*
        senior pool has 20_000 (10_000 from investor 1 and 10_000 from investor 2)
        tranche pool has 2000 (1000 from investor 1 and 1000 from investor 2)
        tranche pool locked with 10_000
        */
        it("should accrue interest with multiple investors", async () => {
          const amount = usdcVal(10000)
          const juniorAmount = usdcVal(1000)
          const drawdownAmount = amount.div(new BN(10))
          const paymentPeriodInDays = new BN(15)

          ;({tranchedPool} = await createPool({_paymentPeriodInDays: paymentPeriodInDays}, POOL_VERSION2))

          await expectAction(async () => {
            await depositToSeniorPool(amount, investor1)
            await depositToSeniorPool(amount, investor2)
            await depositToPool(tranchedPool, juniorAmount, investor1)
            await depositToPool(tranchedPool, juniorAmount, investor2)
          }).toChange([
            [async () => await getBalance(investor1, fidu), {by: usdcToFidu(amount)}],
            [async () => await getBalance(investor2, fidu), {by: usdcToFidu(amount)}],
            [async () => await getBalance(investor1, poolTokens), {by: new BN(1)}],
            [async () => await getBalance(investor2, poolTokens), {by: new BN(1)}],
          ])

          await requestWithdrawalFromSeniorPool(usdcToFidu(amount), investor1)
          await requestWithdrawalFromSeniorPool(usdcToFidu(amount), investor2)

          await lockAndLeveragePool(tranchedPool)
          await drawdown(tranchedPool, drawdownAmount, borrower)

          const totalInterest = await calculateInterest(tranchedPool, creditLine, paymentPeriodInDays, null)
          const expectedSeniorInterest = await calculateInterest(
            tranchedPool,
            creditLine,
            paymentPeriodInDays,
            TRANCHES.Senior
          )
          const expectedJuniorInterest = await calculateInterest(
            tranchedPool,
            creditLine,
            paymentPeriodInDays,
            TRANCHES.Junior
          )

          // Advance to end of payment period and pay back total interest
          await advanceTime({toSecond: await creditLine.nextDueTime()})
          await expectAction(async () => {
            await tranchedPool.pay(totalInterest, {from: borrower})
            const tokenId = await getPoolTokenFor(seniorPool.address)
            await seniorPool.redeem(tokenId)
            await seniorPool.writedown(tokenId)
          }).toChange([[seniorPool.sharePrice, {increase: true}]])
          expect(await creditLine.interestOwed()).to.bignumber.eq(ZERO)

          // There was 10k already in the pool (from the underwriter), so each investor has a third
          const grossExpectedReturn = amount.add(expectedSeniorInterest.div(new BN(3)))
          const expectedReturn = await afterWithdrawalFees(grossExpectedReturn)
          await expectAction(async () => {
            await withdrawFromSeniorPool(1, investor1)
            await withdrawFromSeniorPool(2, investor2) // Withdraw everything in fidu terms
          }).toChange([
            [() => getBalance(investor1, usdc), {byCloseTo: expectedReturn}],
            [() => getBalance(investor2, usdc), {byCloseTo: expectedReturn}], // Also ensures share price is correctly incorporated
          ])

          // Only 2 junior investors, and both were for the same amount. 10% was drawdown, so 90% of junior principal is redeemable
          const principalFractionUsed = (await creditLine.balance()).mul(ONE_HUNDRED).div(limit)
          const juniorPrincipalAvailable = getPercent(juniorAmount, ONE_HUNDRED.sub(principalFractionUsed))
          const expectedJuniorReturn = juniorPrincipalAvailable.add(expectedJuniorInterest.div(new BN(2)))
          await expectAction(async () => {
            await withdrawFromPool(tranchedPool, "max")
            await withdrawFromPool(tranchedPool, expectedJuniorReturn, investor2)
          }).toChange([
            [() => getBalance(investor1, usdc), {byCloseTo: expectedJuniorReturn}],
            [() => getBalance(investor2, usdc), {byCloseTo: expectedJuniorReturn}],
          ])
        })

        it("should handle writedowns correctly", async () => {
          const amount = usdcVal(10000)
          const juniorAmount = usdcVal(1000)
          const drawdownAmount = amount.div(new BN(2))

          await depositToSeniorPool(amount)
          await requestWithdrawalFromSeniorPool(usdcToFidu(amount), investor1)

          await depositToSeniorPool(amount, investor2)
          await createPool({_paymentPeriodInDays: paymentPeriodInDays}, POOL_VERSION2)
          await depositToPool(tranchedPool, juniorAmount)
          await depositToPool(tranchedPool, juniorAmount, investor2)
          await lockAndLeveragePool(tranchedPool)
          await drawdown(tranchedPool, drawdownAmount, borrower)

          await goldfinchConfig.setNumber(CONFIG_KEYS.LatenessGracePeriodInDays, paymentPeriodInDays)
          // Advance to a point where we would definitely write them down
          const fourPeriods = (await creditLine.paymentPeriodInDays()).mul(new BN(4))
          await advanceTime({days: fourPeriods.toNumber()})

          await expectAction(() => checkpointPool(creditLine)).toChange([
            [seniorPool.totalWritedowns, {increase: true}],
            [creditLine.interestOwed, {increase: true}],
            [seniorPool.sharePrice, {decrease: true}],
          ])

          // All the main actions should still work as expected!
          await expect(drawdown(tranchedPool, new BN(10))).to.be.rejected
          await depositToSeniorPool(new BN(10))
          await withdrawFromSeniorPool(1, investor1)
          await makePayment(tranchedPool, new BN(10))
        })
      })

      describe("credit lines and interest rates", async () => {
        beforeEach(async () => {
          limit = usdcVal(10000)
          interestApr = interestAprAsBN("25")
          lateFeeApr = interestAprAsBN("0")
          paymentPeriodInDays = new BN(1)
          termInDays = new BN(365)
          paymentPeriodInSeconds = SECONDS_PER_DAY.mul(paymentPeriodInDays)
        })

        describe("drawdown and isLate", async () => {
          it("should not think you're late if it's not past the nextDueTime", async () => {
            await createPool({_paymentPeriodInDays: new BN(30)}, POOL_VERSION2)
            await depositToPool(tranchedPool, usdcVal(200))
            await lockAndLeveragePool(tranchedPool)
            await expect(drawdown(tranchedPool, new BN(1000))).to.be.fulfilled
            await advanceTime({days: 10})
            // This drawdown will accumulate and record some interest
            await expect(drawdown(tranchedPool, new BN(1))).to.be.fulfilled
            // This one should still work, because you still aren't late...
            await expect(drawdown(tranchedPool, new BN(1))).to.be.fulfilled
          })
        })
      })
    })
  })
})

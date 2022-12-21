import hre from "hardhat"
const {deployments, web3} = hre
import {
  expect,
  BN,
  usdcVal,
  getBalance,
  erc20Approve,
  erc20Transfer,
  usdcToFidu,
  expectAction,
  advanceTime,
  Numberish,
  bigVal,
  ZERO,
  getTranchedPoolAndCreditLine,
} from "./testHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {TRANCHES, interestAprAsBN, MAX_UINT} from "../blockchain_scripts/deployHelpers"
import {deployBaseFixture, deployTranchedPoolWithGoldfinchFactoryFixture} from "./util/fixtures"
import {STAKING_REWARDS_PARAMS} from "../blockchain_scripts/migrations/v2.2/deploy"

// eslint-disable-next-line no-unused-vars
let accounts, owner, underwriter, borrower, investor1, investor2
let fidu, goldfinchConfig, reserve, usdc, seniorPool, creditLine, tranchedPool, poolTokens

const ONE_HUNDRED = new BN(100)

const TEST_TIMEOUT = 60000

describe("Goldfinch", async function () {
  this.timeout(TEST_TIMEOUT)

  let limit = usdcVal(10000)
  let interestApr = interestAprAsBN("25")
  let lateFeeApr = interestAprAsBN("0")
  const juniorFeePercent = new BN(20)
  const allowedUIDTypes = [0]
  const fundableAt = new BN(0)

  const setupTest = deployments.createFixture(async ({deployments}) => {
    const {seniorPool, usdc, fidu, goldfinchConfig, poolTokens, stakingRewards, gfi} = await deployBaseFixture()

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
    return {seniorPool, usdc, fidu, goldfinchConfig, poolTokens, stakingRewards, gfi}
  })

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, underwriter, borrower, investor1, investor2, reserve] = accounts
    ;({usdc, seniorPool, fidu, goldfinchConfig, poolTokens} = await setupTest())
  })

  describe("functional test", async () => {
    async function createPool({
      _borrower,
      _limit,
      _interestApr,
      _lateFeesApr,
      _allowedUIDTypes,
    }: {
      _borrower?: string
      _limit?: Numberish
      _interestApr?: Numberish
      _lateFeesApr?: Numberish
      _allowedUIDTypes?: Array<Numberish>
    } = {}) {
      const deployments = await deployTranchedPoolWithGoldfinchFactoryFixture(`integration`)({
        usdcAddress: usdc.address,
        borrower: borrower || _borrower,
        juniorFeePercent,
        limit: limit || _limit,
        interestApr: interestApr || _interestApr,
        lateFeeApr: lateFeeApr || _lateFeesApr,
        fundableAt: fundableAt,
        allowedUIDTypes: allowedUIDTypes || _allowedUIDTypes,
      })

      ;({tranchedPool, creditLine} = await getTranchedPoolAndCreditLine(deployments.poolAddress, deployments.clAddress))

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

    async function getPoolTokenFor(owner, index?) {
      return poolTokens.tokenOfOwnerByIndex(owner, index || 0)
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

    describe(`TranchedPool`, () => {
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

          ;({tranchedPool, creditLine} = await createPool())

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

          const totalInterest = await creditLine.interestOwedAt(await creditLine.nextDueTime())

          // To get the senior interest, first we need to scale by levarage ratio
          const juniorTotal = new BN((await tranchedPool.getTranche(TRANCHES.Junior)).principalDeposited)
          const seniorTotal = new BN((await tranchedPool.getTranche(TRANCHES.Senior)).principalDeposited)
          const seniorLeveragePercent = ONE_HUNDRED.mul(seniorTotal).div(seniorTotal.add(juniorTotal))
          const reserveFeePercent = ONE_HUNDRED.div(await goldfinchConfig.getNumber(CONFIG_KEYS.ReserveDenominator))
          let seniorInterest = totalInterest.mul(seniorLeveragePercent).div(ONE_HUNDRED)
          const seniorFractionNetFees = ONE_HUNDRED.sub(reserveFeePercent).sub(juniorFeePercent)
          seniorInterest = getPercent(seniorInterest, seniorFractionNetFees)

          const juniorLeveragePercent = ONE_HUNDRED.mul(juniorTotal).div(seniorTotal.add(juniorTotal))
          let juniorInterest = getPercent(totalInterest, juniorLeveragePercent)
          // Subtract fees
          juniorInterest = getPercent(juniorInterest, ONE_HUNDRED.sub(reserveFeePercent))
          // Add junior fee
          const juniorFee = getPercent(seniorInterest, juniorFeePercent)
          juniorInterest = juniorInterest.add(juniorFee)

          // Advance to end of payment period and pay back total interest
          await advanceTime({toSecond: await creditLine.nextDueTime()})
          // WHY DOESNT THE SHARE PRICE INCREASE??!!
          await expectAction(async () => {
            await tranchedPool.pay(totalInterest, {from: borrower})
            const tokenId = await getPoolTokenFor(seniorPool.address)
            await seniorPool.redeem(tokenId)
            await seniorPool.writedown(tokenId)
          }).toChange([[seniorPool.sharePrice, {increase: true}]])
          expect(await creditLine.interestOwed()).to.bignumber.eq(ZERO)

          // There was 10k already in the pool (from the underwriter), so each investor has a third
          const grossExpectedReturn = amount.add(seniorInterest.div(new BN(3)))
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
          const expectedJuniorReturn = juniorPrincipalAvailable.add(juniorInterest.div(new BN(2)))
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
          await createPool()
          await depositToPool(tranchedPool, juniorAmount)
          await depositToPool(tranchedPool, juniorAmount, investor2)
          await lockAndLeveragePool(tranchedPool)
          await drawdown(tranchedPool, drawdownAmount, borrower)

          await goldfinchConfig.setNumber(CONFIG_KEYS.LatenessGracePeriodInDays, new BN(30))
          // Advance to a point where we would definitely write them down
          await advanceTime({days: "180"})

          await expectAction(async () => {
            const tokenId = await getPoolTokenFor(seniorPool.address)
            await seniorPool.redeem(tokenId)
            await seniorPool.writedown(tokenId)
          }).toChange([
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
        })

        describe("drawdown and isLate", async () => {
          it("should not think you're late if it's not past the nextDueTime", async () => {
            await createPool()
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

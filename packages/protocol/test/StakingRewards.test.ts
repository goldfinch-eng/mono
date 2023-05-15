import BN from "bn.js"
import hre from "hardhat"
import {
  ERC20Instance,
  FiduInstance,
  GFIInstance,
  TestStakingRewardsInstance,
  TestFiduUSDCCurveLPInstance,
  TestSeniorPoolInstance,
} from "../typechain/truffle"
const {ethers, deployments} = hre
import {DepositMade} from "../typechain/truffle/contracts/protocol/core/SeniorPool"
import {
  DepositedAndStaked,
  DepositedToCurveAndStaked,
  RewardPaid,
  Staked,
  Unstaked,
} from "../typechain/truffle/contracts/rewards/StakingRewards"
import {
  usdcVal,
  erc20Transfer,
  expect,
  decodeLogs,
  getFirstLog,
  erc20Approve,
  advanceTime,
  bigVal,
  expectAction,
  MAX_UINT,
  getCurrentTimestamp,
  usdcToFidu,
  decimals,
  FIDU_DECIMALS,
  USDC_DECIMALS,
} from "./testHelpers"
import {time, expectEvent} from "@openzeppelin/test-helpers"
import {getApprovalDigest, getWallet} from "./permitHelpers"
import {ecsign} from "ethereumjs-util"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {deployBaseFixture} from "./util/fixtures"
import {StakedPositionType} from "../blockchain_scripts/deployHelpers"
import {DepositedToCurve, UnstakedMultiple} from "../typechain/truffle/contracts/test/TestStakingRewards"

const MULTIPLIER_DECIMALS = new BN(String(1e18))

describe("StakingRewards", function () {
  let owner: string,
    investor: string,
    anotherUser: string,
    nonGoListedUser: string,
    gfi: GFIInstance,
    usdc: ERC20Instance,
    seniorPool: TestSeniorPoolInstance,
    fidu: FiduInstance,
    fiduUSDCCurveLP: TestFiduUSDCCurveLPInstance,
    stakingRewards: TestStakingRewardsInstance

  let fiduAmount: BN
  let anotherUserFiduAmount: BN

  let curveLPAmount: BN

  let targetCapacity: BN
  let maxRate: BN
  let minRate: BN
  let maxRateAtPercent: BN
  let minRateAtPercent: BN

  const yearInSeconds = new BN(365 * 24 * 60 * 60)
  const halfYearInSeconds = yearInSeconds.div(new BN(2))

  async function stake({
    from,
    amount,
    positionType = StakedPositionType.Fidu,
  }: {
    from: string
    amount: BN | string
    positionType?: StakedPositionType
  }): Promise<BN> {
    await fidu.approve(stakingRewards.address, amount, {from})
    await fiduUSDCCurveLP.approve(stakingRewards.address, amount, {from})

    // .call(...) first to get the output of the transaction. This does not write to the chain
    // so the subsequent call is exactly the same.
    const tokenId = await stakingRewards.stake.call(amount, positionType, {from})
    const receipt = await stakingRewards.stake(amount, positionType, {from})
    const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))

    // Verify Staked event has correct fields
    expect(stakedEvent.args.positionType).to.bignumber.equal(new BN(positionType))
    expect(stakedEvent.args.amount).to.bignumber.equal(amount)
    expect(stakedEvent.args.baseTokenExchangeRate).to.bignumber.equal(
      await stakingRewards.getBaseTokenExchangeRate(positionType)
    )
    expect(stakedEvent.args.user).to.equal(from)

    expect(stakedEvent.args.tokenId).to.bignumber.equal(tokenId)

    return stakedEvent.args.tokenId
  }

  async function mintRewards(amount: BN | string) {
    const totalSupply = await gfi.totalSupply()
    await gfi.setCap(totalSupply.add(new BN(amount)))
    await gfi.mint(owner, amount)
    await gfi.approve(stakingRewards.address, amount)
    await stakingRewards.loadRewards(amount)
  }

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const [_owner, _investor, _anotherUser, _nonGoListedUser] = await web3.eth.getAccounts()
    const owner = asNonNullable(_owner)
    const investor = asNonNullable(_investor)
    const anotherUser = asNonNullable(_anotherUser)
    const nonGoListedUser = asNonNullable(_nonGoListedUser)
    const {
      goldfinchConfig,
      seniorPool: _seniorPool,
      gfi,
      stakingRewards,
      fidu,
      usdc,
      fiduUSDCCurveLP,
      ...others
    } = await deployBaseFixture()
    await goldfinchConfig.bulkAddToGoList([owner, investor, anotherUser])
    await erc20Approve(usdc, investor, usdcVal(10000), [owner])
    await erc20Transfer(usdc, [investor], usdcVal(10000), owner)

    await erc20Approve(usdc, anotherUser, usdcVal(50000), [owner])
    await erc20Transfer(usdc, [anotherUser], usdcVal(50000), owner)

    await erc20Approve(usdc, nonGoListedUser, usdcVal(50000), [owner])
    await erc20Transfer(usdc, [nonGoListedUser], usdcVal(50000), owner)

    await erc20Approve(fiduUSDCCurveLP, investor, bigVal(100), [owner])
    await erc20Transfer(fiduUSDCCurveLP, [investor], bigVal(100), owner)

    await erc20Approve(fiduUSDCCurveLP, anotherUser, bigVal(100), [owner])
    await erc20Transfer(fiduUSDCCurveLP, [anotherUser], bigVal(100), owner)

    await erc20Approve(usdc, _seniorPool.address, usdcVal(50000), [anotherUser])
    let receipt = await _seniorPool.deposit(usdcVal(50000), {from: anotherUser})
    let depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, _seniorPool, "DepositMade"))
    const anotherUserFiduAmount = depositEvent.args.shares

    await erc20Approve(usdc, _seniorPool.address, usdcVal(5000), [investor])
    receipt = await _seniorPool.deposit(usdcVal(5000), {from: investor})
    depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, _seniorPool, "DepositMade"))
    const fiduAmount = new BN(depositEvent.args.shares)
    const curveLPAmount = bigVal(100)

    const targetCapacity = bigVal(1000)
    const maxRate = bigVal(1000)
    const minRate = bigVal(100)
    const maxRateAtPercent = new BN(5).mul(new BN(String(1e17))) // 50%
    const minRateAtPercent = new BN(3).mul(new BN(String(1e18))) // 300%

    await stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent)

    return {
      owner,
      investor,
      anotherUser,
      nonGoListedUser,
      goldfinchConfig,
      seniorPool: _seniorPool as TestSeniorPoolInstance,
      gfi,
      stakingRewards,
      fidu,
      usdc,
      fiduUSDCCurveLP,
      targetCapacity,
      maxRate,
      minRate,
      maxRateAtPercent,
      minRateAtPercent,
      fiduAmount,
      anotherUserFiduAmount,
      curveLPAmount,
      ...others,
    }
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      investor,
      anotherUser,
      nonGoListedUser,
      seniorPool,
      gfi,
      stakingRewards,
      fidu,
      usdc,
      fiduUSDCCurveLP,
      targetCapacity,
      maxRate,
      minRate,
      maxRateAtPercent,
      minRateAtPercent,
      fiduAmount,
      anotherUserFiduAmount,
      curveLPAmount,
    } = await testSetup())
  })

  beforeEach(async () => {
    // Reset balances such that 1 FIDU underlies a single Curve LP token
    await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS)
    await fiduUSDCCurveLP._setBalance(1, USDC_DECIMALS)
    await fiduUSDCCurveLP._setTotalSupply(MULTIPLIER_DECIMALS)
  })

  describe("stakingAndRewardsTokenMantissa", () => {
    it("returns the expected value", async () => {
      const stakingAndRewardsTokenMantissa = await stakingRewards._getStakingAndRewardsTokenMantissa()
      const fiduStakingTokenMantissa = await stakingRewards._getFiduStakingTokenMantissa()
      const curveLPStakingTokenMantissa = await stakingRewards._getCurveLPStakingTokenMantissa()
      const rewardsTokenMantissa = await stakingRewards._getRewardsTokenMantissa()
      expect(stakingAndRewardsTokenMantissa).to.bignumber.equal(fiduStakingTokenMantissa)
      expect(stakingAndRewardsTokenMantissa).to.bignumber.equal(curveLPStakingTokenMantissa)
      expect(stakingAndRewardsTokenMantissa).to.bignumber.equal(rewardsTokenMantissa)
      expect(stakingAndRewardsTokenMantissa).to.bignumber.equal(FIDU_DECIMALS)
    })
  })

  describe("stake", () => {
    let totalRewards: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)

      // Reset the effective multiplier for the Curve to 1x
      await stakingRewards.setEffectiveMultiplier(new BN(1).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)
    })

    context("for a FIDU position", async () => {
      it("returns a token id", async () => {
        const startSupply = await stakingRewards._tokenIdTracker()

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
        const tokenId = await stakingRewards.stake.call(fiduAmount, StakedPositionType.Fidu, {from: investor})

        expect(tokenId).to.bignumber.equal(startSupply.add(new BN(1)))
      })

      it("stakes and mints a position token", async () => {
        // Have anotherUser stake
        await stake({amount: anotherUserFiduAmount, from: anotherUser})

        await advanceTime({seconds: 100})

        const fiduBalanceBefore = await fidu.balanceOf(investor)

        const tokenId = await stake({amount: fiduAmount, from: investor})

        // Verify fidu was staked
        expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
        expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(fiduAmount)
        expect(await fidu.balanceOf(investor)).to.bignumber.equal(fiduBalanceBefore.sub(fiduAmount))

        // Claim rewards
        await advanceTime({seconds: 100})

        const receipt = await stakingRewards.getReward(tokenId, {from: investor})
        const rewardEvent = getFirstLog<RewardPaid>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "RewardPaid"))
        const gfiBalance = await gfi.balanceOf(investor)
        expect(gfiBalance).to.bignumber.gt(new BN("0"))
        expect(gfiBalance).to.bignumber.equal(rewardEvent.args.reward)

        // Unstake fidu
        await stakingRewards.unstake(tokenId, fiduAmount, {from: investor})
        expect(await fidu.balanceOf(investor)).to.bignumber.equal(fiduAmount)

        // Since we withdrew, rewards should remain unchanged when attempting to claim again
        await advanceTime({seconds: 100})

        expect(await gfi.balanceOf(investor)).to.bignumber.equal(rewardEvent.args.reward)
      })

      it("gives them rewards depending on how long they were staked", async () => {
        await stake({amount: fiduAmount, from: anotherUser})
        const startTime = await time.latest()

        await advanceTime({seconds: 1000})

        const tokenId = await stake({amount: fiduAmount, from: investor})
        const timeDiff = (await time.latest()).sub(startTime)

        await advanceTime({seconds: yearInSeconds})

        await stakingRewards.getReward(tokenId, {from: investor})

        // Rewards only lasted for 1 year, but investor entered after 1000 seconds.
        // Therefore they should get half the rewards for (1 year - 1000 seconds)
        const expectedRewards = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
        expect(await gfi.balanceOf(investor)).to.bignumber.equal(expectedRewards)
      })

      it("splits rewards amongst stakers proportional to their stakes", async () => {
        // anotherUser stakes 4x more than investor
        const anotherUserToken = await stake({amount: fiduAmount.mul(new BN(4)), from: anotherUser})
        const startTime = await time.latest()

        const tokenId = await stake({amount: fiduAmount, from: investor})
        const timeDiff = (await time.latest()).sub(startTime)

        await advanceTime({seconds: yearInSeconds})

        // investor owns 1/5 of the staked supply and therefore should receive 1/5
        // of the disbursed rewards
        await stakingRewards.getReward(tokenId, {from: investor})
        let expectedRewards = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(5))
        expect(await gfi.balanceOf(investor)).to.bignumber.equal(expectedRewards)

        // anotherUser owns 4/5 of the staked supply and therefore should receive 4/5
        // of the disbursed rewards
        await stakingRewards.getReward(anotherUserToken, {from: anotherUser})
        const rewardsWhenOnlyAnotherUserWasStaked = maxRate.mul(timeDiff)
        const rewardsWhenInvestorWasStaked = maxRate.mul(yearInSeconds.sub(timeDiff)).mul(new BN(4)).div(new BN(5))
        expectedRewards = rewardsWhenOnlyAnotherUserWasStaked.add(rewardsWhenInvestorWasStaked)
        expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(expectedRewards)
      })
    })

    context("when trying to view their claimable amount", async () => {
      it("handles multiple tokens", async () => {
        await stake({amount: fiduAmount, from: anotherUser})
        await stake({amount: fiduAmount, from: anotherUser})
        await advanceTime({seconds: yearInSeconds})
        // Need to tickle the contract so there's a new checkpoint
        await stake({amount: fiduAmount, from: investor})

        const amountClaimable = (
          await Promise.all(
            [...Array(await (await stakingRewards.balanceOf(anotherUser)).toNumber())].map(async (_, i) => {
              const tokenId = await stakingRewards.tokenOfOwnerByIndex(anotherUser, i)
              return stakingRewards.optimisticClaimable(tokenId.toString())
            })
          )
        ).reduce((acc, claimable) => acc.add(new BN(claimable)), new BN(0))

        // In this example, the user was the only one staking, so they got all the rewards
        expect(amountClaimable).to.bignumber.equal(totalRewards)
      })

      it("handles partial time periods, and many people staking", async () => {
        await stake({amount: fiduAmount, from: anotherUser})
        await stake({amount: new BN(1), from: investor})
        await advanceTime({seconds: yearInSeconds.div(new BN(2))})
        // Need to tickle the contract so there's a new checkpoint
        await stake({amount: new BN(1), from: investor})

        const amountClaimable = (
          await Promise.all(
            [...Array(await (await stakingRewards.balanceOf(anotherUser)).toNumber())].map(async (_, i) => {
              const tokenId = await stakingRewards.tokenOfOwnerByIndex(anotherUser, i)
              return stakingRewards.optimisticClaimable(tokenId.toString())
            })
          )
        ).reduce((acc, claimable) => acc.add(new BN(claimable)), new BN(0))
        expect(amountClaimable).to.bignumber.closeTo(totalRewards.div(new BN(2)), totalRewards.div(new BN(100)))
      })
    })

    context("for a Curve LP position", async () => {
      it("returns a token id", async () => {
        const startSupply = await stakingRewards._tokenIdTracker()

        await fiduUSDCCurveLP.approve(stakingRewards.address, curveLPAmount, {from: investor})
        const tokenId = await stakingRewards.stake.call(curveLPAmount, StakedPositionType.CurveLP, {from: investor})

        expect(tokenId).to.bignumber.equal(new BN(startSupply).add(new BN(1)))
      })

      it("stakes and mints a position token", async () => {
        // Have anotherUser stake
        await stake({amount: anotherUserFiduAmount, from: anotherUser})

        await advanceTime({seconds: 100})

        const fiduUSDCCurveLPBalanceBefore = await fiduUSDCCurveLP.balanceOf(investor)

        const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})

        // Verify FIDU-USDC Curve LP Token was staked
        expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
        expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(curveLPAmount)
        expect(await fiduUSDCCurveLP.balanceOf(investor)).to.bignumber.equal(
          fiduUSDCCurveLPBalanceBefore.sub(curveLPAmount)
        )

        // Claim rewards
        await advanceTime({seconds: 100})

        const receipt = await stakingRewards.getReward(tokenId, {from: investor})
        const rewardEvent = getFirstLog<RewardPaid>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "RewardPaid"))
        const gfiBalance = await gfi.balanceOf(investor)
        expect(gfiBalance).to.bignumber.gt(new BN("0"))
        expect(gfiBalance).to.bignumber.equal(rewardEvent.args.reward)

        // Unstake FIDU-USDC Curve LP Token
        await stakingRewards.unstake(tokenId, curveLPAmount, {from: investor})
        expect(await fiduUSDCCurveLP.balanceOf(investor)).to.bignumber.equal(curveLPAmount)

        // Since we withdrew, rewards should remain unchanged when attempting to claim again
        await advanceTime({seconds: 100})

        expect(await gfi.balanceOf(investor)).to.bignumber.equal(rewardEvent.args.reward)
      })

      it("distributes rewards using the effective multiplier", async () => {
        await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)

        // anotherUser stakes 2x more FIDU tokens than investor in Curve LP tokens
        const anotherUserToken = await stake({
          amount: curveLPAmount.mul(new BN(2)),
          from: anotherUser,
        })
        const startTime = await time.latest()

        const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
        const timeDiff = (await time.latest()).sub(startTime)

        await advanceTime({seconds: yearInSeconds})

        // investor owns 1/2 of the staked supply and therefore should receive 1/2
        // of the disbursed rewards
        await stakingRewards.getReward(tokenId, {from: investor})
        let expectedRewards = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
        expect(await gfi.balanceOf(investor)).to.bignumber.equal(expectedRewards)

        // anotherUser owns 1/2 of the staked supply and therefore should receive 1/2
        // of the disbursed rewards
        await stakingRewards.getReward(anotherUserToken, {from: anotherUser})
        const rewardsWhenOnlyAnotherUserWasStaked = maxRate.mul(timeDiff)
        const rewardsWhenInvestorWasStaked = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
        expectedRewards = rewardsWhenOnlyAnotherUserWasStaked.add(rewardsWhenInvestorWasStaked)
        expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(expectedRewards)
      })

      it("gives them rewards depending on how long they were staked", async () => {
        await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: anotherUser})
        const startTime = await time.latest()

        await advanceTime({seconds: 1000})

        const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
        const timeDiff = (await time.latest()).sub(startTime)

        await advanceTime({seconds: yearInSeconds})

        await stakingRewards.getReward(tokenId, {from: investor})

        // Rewards only lasted for 1 year, but investor entered after 1000 seconds.
        // Therefore they should get half the rewards for (1 year - 1000 seconds)
        const expectedRewards = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
        expect(await gfi.balanceOf(investor)).to.bignumber.equal(expectedRewards)
      })

      it("splits rewards amongst stakers proportional to their stakes", async () => {
        // anotherUser stakes 4x more than investor
        const anotherUserToken = await stake({
          amount: curveLPAmount.mul(new BN(4)),
          from: anotherUser,
        })
        const startTime = await time.latest()

        const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
        const timeDiff = (await time.latest()).sub(startTime)

        await advanceTime({seconds: yearInSeconds})

        // investor owns 1/5 of the staked supply and therefore should receive 1/5
        // of the disbursed rewards
        await stakingRewards.getReward(tokenId, {from: investor})
        let expectedRewards = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(5))
        expect(await gfi.balanceOf(investor)).to.bignumber.equal(expectedRewards)

        // anotherUser owns 4/5 of the staked supply and therefore should receive 4/5
        // of the disbursed rewards
        await stakingRewards.getReward(anotherUserToken, {from: anotherUser})
        const rewardsWhenOnlyAnotherUserWasStaked = maxRate.mul(timeDiff)
        const rewardsWhenInvestorWasStaked = maxRate.mul(yearInSeconds.sub(timeDiff)).mul(new BN(4)).div(new BN(5))
        expectedRewards = rewardsWhenOnlyAnotherUserWasStaked.add(rewardsWhenInvestorWasStaked)
        expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(expectedRewards)
      })

      it("splits rewards amongst stakers proportional to their stakes with different exchange rates", async () => {
        const onePointFive = new BN(3).div(new BN(2))
        const onePointFiveMultiplier = MULTIPLIER_DECIMALS.mul(onePointFive)

        // Set balances such that 1.5 FIDU underlies a single Curve LP token
        await fiduUSDCCurveLP._setBalance(0, onePointFiveMultiplier)
        await fiduUSDCCurveLP._setTotalSupply(MULTIPLIER_DECIMALS)
        expect(await stakingRewards.getBaseTokenExchangeRate(StakedPositionType.CurveLP)).to.bignumber.equal(
          onePointFiveMultiplier
        )

        // anotherUser stakes 1.5x more FIDU tokens than investor in Curve LP tokens
        const anotherUserToken = await stake({
          amount: curveLPAmount.mul(onePointFive),
          from: anotherUser,
        })
        const startTime = await time.latest()

        const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
        const timeDiff = (await time.latest()).sub(startTime)

        await advanceTime({seconds: yearInSeconds})

        // investor owns 1/2 of the staked supply and therefore should receive 1/2
        // of the disbursed rewards
        await stakingRewards.getReward(tokenId, {from: investor})
        let expectedRewards = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
        expect(await gfi.balanceOf(investor)).to.bignumber.equal(expectedRewards)

        // anotherUser owns 1/2 of the staked supply and therefore should receive 1/2
        // of the disbursed rewards
        await stakingRewards.getReward(anotherUserToken, {from: anotherUser})
        const rewardsWhenOnlyAnotherUserWasStaked = maxRate.mul(timeDiff)
        const rewardsWhenInvestorWasStaked = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
        expectedRewards = rewardsWhenOnlyAnotherUserWasStaked.add(rewardsWhenInvestorWasStaked)
        expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(expectedRewards)
      })

      context("when the Curve pool is imbalanced", async () => {
        it("allows staking when the Curve pool is slightly imbalanced", async () => {
          // Set Senior Pool FIDU share price to be $1
          await seniorPool._setSharePrice(MULTIPLIER_DECIMALS)

          // Set balances such that there is 1.2 USDC for every FIDU token in the Curve pool
          await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS)
          await fiduUSDCCurveLP._setBalance(1, USDC_DECIMALS.mul(new BN(12)).div(new BN(10)))

          await expect(stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})).to.be
            .fulfilled
        })

        it("does not allow staking when the Curve pool has significaly more FIDU than USDC", async () => {
          // Set Senior Pool FIDU share price to be $1
          await seniorPool._setSharePrice(MULTIPLIER_DECIMALS)

          // Set balances such that there is 0.7 USDC for every FIDU token in the Curve pool
          await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS)
          await fiduUSDCCurveLP._setBalance(1, USDC_DECIMALS.mul(new BN(7)).div(new BN(10)))

          await expect(
            stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
          ).to.be.rejectedWith(/IM/)
        })

        it("does not allow staking when the Curve pool has significaly more USDC than FIDU", async () => {
          // Set Senior Pool FIDU share price to be $1
          await seniorPool._setSharePrice(MULTIPLIER_DECIMALS)

          // Set balances such that there is 1.3 USDC for every FIDU token in the Curve pool
          await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS)
          await fiduUSDCCurveLP._setBalance(1, USDC_DECIMALS.mul(new BN(13)).div(new BN(10)))

          await expect(
            stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
          ).to.be.rejectedWith(/IM/)
        })
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        await stakingRewards.pause()
        await expect(stake({amount: fiduAmount, from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("depositAndStake", async () => {
    it("returns a token id", async () => {
      const amount = usdcVal(1000)
      const startSupply = await stakingRewards._tokenIdTracker()

      await usdc.approve(stakingRewards.address, amount, {from: investor})
      const tokenId = await stakingRewards.depositAndStake.call(amount, {from: investor})

      expect(tokenId).to.bignumber.equal(new BN(startSupply).add(new BN(1)))
    })

    it("deposits into senior pool and stakes resulting shares", async () => {
      const amount = usdcVal(1000)
      const balanceBefore = await usdc.balanceOf(investor)
      const seniorPoolAssetsBefore = await seniorPool.assets()

      await usdc.approve(stakingRewards.address, amount, {from: investor})
      const returnedTokenId = await stakingRewards.depositAndStake.call(amount, {from: investor})
      const receipt = await stakingRewards.depositAndStake(amount, {from: investor})
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const depositedAndStakedEvent = getFirstLog<DepositedAndStaked>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedAndStaked")
      )
      const expectedSharePrice = new BN(1).mul(decimals)

      // Verify events
      expect(stakedEvent.args.user).to.equal(investor)
      const tokenId = stakedEvent.args.tokenId
      expect(stakedEvent.args.amount).to.bignumber.equal(usdcToFidu(amount).mul(decimals).div(expectedSharePrice))

      expect(depositedAndStakedEvent.args.user).to.equal(stakedEvent.args.user)
      expect(depositedAndStakedEvent.args.depositedAmount).to.bignumber.equal(amount)
      expect(depositedAndStakedEvent.args.tokenId).to.equal(tokenId)
      expect(depositedAndStakedEvent.args.amount).to.bignumber.equal(stakedEvent.args.amount)
      expect(depositedAndStakedEvent.args.tokenId).to.bignumber.equal(returnedTokenId)

      // Verify deposit worked
      expect(await usdc.balanceOf(investor)).to.bignumber.equal(balanceBefore.sub(amount))
      expect(await seniorPool.assets()).to.bignumber.equal(seniorPoolAssetsBefore.add(amount))

      // Verify shares were staked
      expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(bigVal(1000))

      // Verify that allowance was correctly used
      expect(await usdc.allowance(stakingRewards.address, seniorPool.address)).to.bignumber.equal(new BN(0))
    })

    context("paused", async () => {
      it("reverts", async () => {
        await stakingRewards.pause()
        await expect(stakingRewards.depositAndStake(usdcVal(1000), {from: investor})).to.be.rejectedWith(/paused/)
      })
    })

    context("not go-listed", async () => {
      it("reverts", async () => {
        await expect(stakingRewards.depositAndStake(usdcVal(1000), {from: nonGoListedUser})).to.be.rejectedWith(/GL/)
      })
    })
  })

  describe("depositWithPermitAndStake", async () => {
    it("returns a token id", async () => {
      const amount = usdcVal(1000)
      const startSupply = await stakingRewards._tokenIdTracker()

      const nonce = await (usdc as any).nonces(investor)
      const deadline = MAX_UINT

      // Create signature for permit
      const digest = await getApprovalDigest({
        token: usdc,
        owner: investor,
        spender: stakingRewards.address,
        value: amount,
        nonce,
        deadline,
      })
      const wallet = await getWallet(investor)
      assertNonNullable(wallet)
      const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      const tokenId = await stakingRewards.depositWithPermitAndStake.call(amount, deadline, v, r as any, s as any, {
        from: investor,
      })

      expect(tokenId).to.bignumber.equal(new BN(startSupply).add(new BN(1)))
    })

    it("deposits into senior pool using permit and stakes resulting shares", async () => {
      const nonce = await (usdc as any).nonces(investor)
      const deadline = MAX_UINT
      const amount = usdcVal(1000)

      // Create signature for permit
      const digest = await getApprovalDigest({
        token: usdc,
        owner: investor,
        spender: stakingRewards.address,
        value: amount,
        nonce,
        deadline,
      })
      const wallet = await getWallet(investor)
      assertNonNullable(wallet)
      const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      const balanceBefore = await usdc.balanceOf(investor)
      const seniorPoolAssetsBefore = await seniorPool.assets()

      const returnedTokenId = await stakingRewards.depositWithPermitAndStake.call(
        amount,
        deadline,
        v,
        r as any,
        s as any,
        {
          from: investor,
        }
      )
      const receipt = await stakingRewards.depositWithPermitAndStake(amount, deadline, v, r as any, s as any, {
        from: investor,
      })
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const depositedAndStakedEvent = getFirstLog<DepositedAndStaked>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedAndStaked")
      )
      const expectedSharePrice = new BN(1).mul(decimals)

      // Verify events
      expect(stakedEvent.args.user).to.equal(investor)
      const tokenId = stakedEvent.args.tokenId
      expect(stakedEvent.args.amount).to.bignumber.equal(usdcToFidu(amount).mul(decimals).div(expectedSharePrice))

      expect(depositedAndStakedEvent.args.user).to.equal(stakedEvent.args.user)
      expect(depositedAndStakedEvent.args.depositedAmount).to.bignumber.equal(amount)
      expect(depositedAndStakedEvent.args.tokenId).to.equal(tokenId)
      expect(depositedAndStakedEvent.args.amount).to.bignumber.equal(stakedEvent.args.amount)
      expect(depositedAndStakedEvent.args.tokenId).to.bignumber.equal(returnedTokenId)

      // Verify deposit worked
      expect(await usdc.balanceOf(investor)).to.bignumber.equal(balanceBefore.sub(amount))
      expect(await seniorPool.assets()).to.bignumber.equal(seniorPoolAssetsBefore.add(amount))

      // Verify shares were staked
      expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(bigVal(1000))

      // Verify that allowance was correctly used
      expect(await usdc.allowance(stakingRewards.address, seniorPool.address)).to.bignumber.equal(new BN(0))

      // Verify that permit allowance was correctly used
      expect(await usdc.allowance(investor, stakingRewards.address)).to.bignumber.equal(new BN(0))
    })

    context("paused", async () => {
      it("reverts", async () => {
        const nonce = await (usdc as any).nonces(investor)
        const deadline = MAX_UINT
        const amount = usdcVal(1000)

        // Create signature for permit
        const digest = await getApprovalDigest({
          token: usdc,
          owner: investor,
          spender: stakingRewards.address,
          value: amount,
          nonce,
          deadline,
        })
        const wallet = await getWallet(investor)
        assertNonNullable(wallet)
        const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

        await stakingRewards.pause()
        await expect(
          stakingRewards.depositWithPermitAndStake(amount, deadline, v, r as any, s as any, {
            from: investor,
          })
        ).to.be.rejectedWith(/paused/)
      })
    })

    context("not go-listed", async () => {
      it("reverts", async () => {
        const wallet = await getWallet(nonGoListedUser)
        assertNonNullable(wallet)

        await expect(stakingRewards.depositAndStake(usdcVal(1000), {from: nonGoListedUser})).to.be.rejectedWith(/GL/)
      })
    })
  })

  describe("depositToCurve", async () => {
    const fiduAmount = bigVal(500)
    const usdcAmount = usdcVal(1000)

    beforeEach(async function () {
      // Mint rewards for a full year
      const totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)
    })

    it("deposits a FIDU-only position into Curve", async () => {
      const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
      const fiduBalanceBefore = await fidu.balanceOf(investor)
      const fiduUSDCBalanceBefore = await fiduUSDCCurveLP.balanceOf(investor)

      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

      const receipt = await stakingRewards.depositToCurve(fiduAmount, new BN(0), {from: investor})
      const depositedToCurveEvent = getFirstLog<DepositedToCurve>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedToCurve")
      )

      const amount = await fiduUSDCCurveLP.calc_token_amount([fiduAmount, new BN(0)])

      // Verify event
      expect(depositedToCurveEvent.args.user).to.equal(investor)
      expect(depositedToCurveEvent.args.tokensReceived).to.bignumber.equal(amount)
      expect(depositedToCurveEvent.args.fiduAmount).to.bignumber.equal(fiduAmount)
      expect(depositedToCurveEvent.args.usdcAmount).to.bignumber.equal(new BN(0))

      // Verify deposit worked
      expect(await fidu.balanceOf(investor)).to.bignumber.equal(fiduBalanceBefore.sub(fiduAmount))
      expect(await fiduUSDCCurveLP.balanceOf(investor)).to.bignumber.equal(fiduUSDCBalanceBefore.add(amount))

      // Verify that allowance was correctly used
      expect(await fidu.allowance(stakingRewards.address, fiduUSDCCurveLP.address)).to.bignumber.equal(new BN(0))

      // Verify that it did not stake
      expect(await stakingRewards.totalStakedSupply()).to.bignumber.equal(totalStakedSupplyBefore)
    })

    it("deposits a USDC-only position into Curve", async () => {
      const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
      const usdcBalanceBefore = await usdc.balanceOf(investor)
      const fiduUSDCBalanceBefore = await fiduUSDCCurveLP.balanceOf(investor)

      await usdc.approve(stakingRewards.address, usdcAmount, {from: investor})

      const receipt = await stakingRewards.depositToCurve(new BN(0), usdcAmount, {from: investor})
      const depositedToCurveEvent = getFirstLog<DepositedToCurve>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedToCurve")
      )

      const amount = await fiduUSDCCurveLP.calc_token_amount([new BN(0), usdcAmount])

      // Verify event
      expect(depositedToCurveEvent.args.user).to.equal(investor)
      expect(depositedToCurveEvent.args.tokensReceived).to.bignumber.equal(amount)
      expect(depositedToCurveEvent.args.fiduAmount).to.bignumber.equal(new BN(0))
      expect(depositedToCurveEvent.args.usdcAmount).to.bignumber.equal(usdcAmount)

      // Verify deposit worked
      expect(await usdc.balanceOf(investor)).to.bignumber.equal(usdcBalanceBefore.sub(usdcAmount))
      expect(await fiduUSDCCurveLP.balanceOf(investor)).to.bignumber.equal(fiduUSDCBalanceBefore.add(amount))

      // Verify that allowance was correctly used
      expect(await usdc.allowance(stakingRewards.address, fiduUSDCCurveLP.address)).to.bignumber.equal(new BN(0))

      // Verify that it did not stake
      expect(await stakingRewards.totalStakedSupply()).to.bignumber.equal(totalStakedSupplyBefore)
    })

    it("deposits both FIDU and USDC into Curve", async () => {
      const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
      const fiduBalanceBefore = await fidu.balanceOf(investor)
      const usdcBalanceBefore = await usdc.balanceOf(investor)
      const fiduUSDCBalanceBefore = await fiduUSDCCurveLP.balanceOf(investor)

      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
      await usdc.approve(stakingRewards.address, usdcAmount, {from: investor})

      const receipt = await stakingRewards.depositToCurve(fiduAmount, usdcAmount, {from: investor})
      const depositedToCurveEvent = getFirstLog<DepositedToCurve>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedToCurve")
      )

      const amount = await fiduUSDCCurveLP.calc_token_amount([fiduAmount, usdcAmount])

      // Verify event
      expect(depositedToCurveEvent.args.user).to.equal(investor)
      expect(depositedToCurveEvent.args.tokensReceived).to.bignumber.equal(amount)
      expect(depositedToCurveEvent.args.fiduAmount).to.bignumber.equal(fiduAmount)
      expect(depositedToCurveEvent.args.usdcAmount).to.bignumber.equal(usdcAmount)

      // Verify deposit worked
      expect(await fidu.balanceOf(investor)).to.bignumber.equal(fiduBalanceBefore.sub(fiduAmount))
      expect(await usdc.balanceOf(investor)).to.bignumber.equal(usdcBalanceBefore.sub(usdcAmount))
      expect(await fiduUSDCCurveLP.balanceOf(investor)).to.bignumber.equal(fiduUSDCBalanceBefore.add(amount))

      // Verify that allowance was correctly used
      expect(await fidu.allowance(stakingRewards.address, fiduUSDCCurveLP.address)).to.bignumber.equal(new BN(0))
      expect(await usdc.allowance(stakingRewards.address, fiduUSDCCurveLP.address)).to.bignumber.equal(new BN(0))

      // Verify that it did not stake
      expect(await stakingRewards.totalStakedSupply()).to.bignumber.equal(totalStakedSupplyBefore)
    })

    context("when the slippage is too high", async () => {
      it("reverts", async () => {
        await fiduUSDCCurveLP._setSlippage(MULTIPLIER_DECIMALS.mul(new BN(2)).div(new BN(3)))

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
        await usdc.approve(stakingRewards.address, usdcAmount, {from: investor})

        await expect(stakingRewards.depositToCurve(fiduAmount, usdcAmount, {from: investor})).to.be.rejectedWith(
          /Slippage too high/
        )
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        await stakingRewards.pause()

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
        await usdc.approve(stakingRewards.address, usdcAmount, {from: investor})

        await expect(stakingRewards.depositToCurve(fiduAmount, usdcAmount, {from: investor})).to.be.rejectedWith(
          /paused/
        )
      })
    })
  })

  describe("depositToCurveAndStake", async () => {
    const fiduAmount = bigVal(500)
    const usdcAmount = usdcVal(1000)

    beforeEach(async function () {
      // Mint rewards for a full year
      const totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)
    })

    it("deposits a FIDU-only position into Curve and stakes resulting tokens", async () => {
      const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
      const fiduBalanceBefore = await fidu.balanceOf(investor)

      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

      const receipt = await stakingRewards.depositToCurveAndStake(fiduAmount, new BN(0), {from: investor})
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const depositedAndStakedEvent = getFirstLog<DepositedToCurveAndStaked>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedToCurveAndStaked")
      )

      const amount = await fiduUSDCCurveLP.calc_token_amount([fiduAmount, new BN(0)])

      // Verify events
      expect(stakedEvent.args.user).to.equal(investor)
      const tokenId = stakedEvent.args.tokenId
      expect(stakedEvent.args.amount).to.bignumber.equal(amount)

      expect(depositedAndStakedEvent.args.user).to.equal(stakedEvent.args.user)
      expect(depositedAndStakedEvent.args.amount).to.bignumber.equal(amount)
      expect(depositedAndStakedEvent.args.tokenId).to.equal(tokenId)
      expect(depositedAndStakedEvent.args.fiduAmount).to.bignumber.equal(fiduAmount)
      expect(depositedAndStakedEvent.args.usdcAmount).to.bignumber.equal(new BN(0))

      // Verify deposit worked
      expect(await fidu.balanceOf(investor)).to.bignumber.equal(fiduBalanceBefore.sub(fiduAmount))
      expect(await stakingRewards.totalStakedSupply()).to.bignumber.equal(totalStakedSupplyBefore.add(amount))

      // Verify shares were staked
      expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(amount)

      // Verify that allowance was correctly used
      expect(await fidu.allowance(stakingRewards.address, seniorPool.address)).to.bignumber.equal(new BN(0))
    })

    it("deposits a USDC-only position into Curve and stakes resulting tokens", async () => {
      const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
      const usdcBalanceBefore = await usdc.balanceOf(investor)

      await usdc.approve(stakingRewards.address, usdcAmount, {from: investor})

      const receipt = await stakingRewards.depositToCurveAndStake(new BN(0), usdcAmount, {from: investor})
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const depositedAndStakedEvent = getFirstLog<DepositedToCurveAndStaked>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedToCurveAndStaked")
      )

      const amount = await fiduUSDCCurveLP.calc_token_amount([new BN(0), usdcAmount])

      // Verify events
      expect(stakedEvent.args.user).to.equal(investor)
      const tokenId = stakedEvent.args.tokenId
      expect(stakedEvent.args.amount).to.bignumber.equal(amount)

      expect(depositedAndStakedEvent.args.user).to.equal(stakedEvent.args.user)
      expect(depositedAndStakedEvent.args.amount).to.bignumber.equal(amount)
      expect(depositedAndStakedEvent.args.tokenId).to.equal(tokenId)
      expect(depositedAndStakedEvent.args.fiduAmount).to.bignumber.equal(new BN(0))
      expect(depositedAndStakedEvent.args.usdcAmount).to.bignumber.equal(usdcAmount)

      // Verify deposit worked
      expect(await usdc.balanceOf(investor)).to.bignumber.equal(usdcBalanceBefore.sub(usdcAmount))
      expect(await stakingRewards.totalStakedSupply()).to.bignumber.equal(totalStakedSupplyBefore.add(amount))

      // Verify shares were staked
      expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(amount)

      // Verify that allowance was correctly used
      expect(await usdc.allowance(stakingRewards.address, seniorPool.address)).to.bignumber.equal(new BN(0))
    })

    it("deposits both FIDU and USDC into Curve and stakes resulting tokens", async () => {
      const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
      const fiduBalanceBefore = await fidu.balanceOf(investor)
      const usdcBalanceBefore = await usdc.balanceOf(investor)

      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
      await usdc.approve(stakingRewards.address, usdcAmount, {from: investor})

      const receipt = await stakingRewards.depositToCurveAndStake(fiduAmount, usdcAmount, {from: investor})
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const depositedAndStakedEvent = getFirstLog<DepositedToCurveAndStaked>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "DepositedToCurveAndStaked")
      )

      const amount = await fiduUSDCCurveLP.calc_token_amount([fiduAmount, usdcAmount])

      // Verify events
      expect(stakedEvent.args.user).to.equal(investor)
      const tokenId = stakedEvent.args.tokenId
      expect(stakedEvent.args.amount).to.bignumber.equal(amount)

      expect(depositedAndStakedEvent.args.user).to.equal(stakedEvent.args.user)
      expect(depositedAndStakedEvent.args.amount).to.bignumber.equal(amount)
      expect(depositedAndStakedEvent.args.tokenId).to.equal(tokenId)
      expect(depositedAndStakedEvent.args.fiduAmount).to.bignumber.equal(fiduAmount)
      expect(depositedAndStakedEvent.args.usdcAmount).to.bignumber.equal(usdcAmount)

      // Verify deposit worked
      expect(await fidu.balanceOf(investor)).to.bignumber.equal(fiduBalanceBefore.sub(fiduAmount))
      expect(await usdc.balanceOf(investor)).to.bignumber.equal(usdcBalanceBefore.sub(usdcAmount))
      expect(await stakingRewards.totalStakedSupply()).to.bignumber.equal(totalStakedSupplyBefore.add(amount))

      // Verify shares were staked
      expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(amount)

      // Verify that allowance was correctly used
      expect(await fidu.allowance(stakingRewards.address, seniorPool.address)).to.bignumber.equal(new BN(0))
      expect(await usdc.allowance(stakingRewards.address, seniorPool.address)).to.bignumber.equal(new BN(0))
    })

    context("paused", async () => {
      it("reverts", async () => {
        await stakingRewards.pause()
        await expect(
          stakingRewards.depositToCurveAndStake(fiduAmount, usdcAmount, {from: investor})
        ).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("unstake", async () => {
    let totalRewards: BN
    let rewardRate: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      rewardRate = bigVal(100)

      // Fix the reward rate
      await stakingRewards.setRewardsParameters(
        targetCapacity,
        rewardRate,
        rewardRate,
        minRateAtPercent,
        maxRateAtPercent
      )

      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)
    })

    it("transfers staked tokens to sender", async () => {
      await stake({amount: fiduAmount.mul(new BN(4)), from: anotherUser})

      const tokenId = await stake({amount: fiduAmount, from: investor})

      const withdrawAmount = fiduAmount.div(new BN(2))
      await expectAction(async () => {
        const receipt = await stakingRewards.unstake(tokenId, withdrawAmount, {from: investor})
        expectEvent(receipt, "Unstaked", {user: investor, tokenId, amount: withdrawAmount})
      }).toChange([
        [() => fidu.balanceOf(investor), {by: withdrawAmount}],
        [() => stakingRewards.totalStakedSupply(), {by: withdrawAmount.neg()}],
      ])
      await expectAction(() => stakingRewards.unstake(tokenId, withdrawAmount, {from: investor})).toChange([
        [() => fidu.balanceOf(investor), {by: withdrawAmount}],
        [() => stakingRewards.totalStakedSupply(), {by: withdrawAmount.neg()}],
      ])
      await expect(stakingRewards.unstake(tokenId, withdrawAmount, {from: investor})).to.be.rejected
    })

    it("ends rewards for the tokenId", async () => {
      const tokenId = await stake({amount: fiduAmount, from: investor})

      await advanceTime({seconds: 10000})

      await stakingRewards.unstake(tokenId, fiduAmount, {from: investor})
      await stakingRewards.getReward(tokenId, {from: investor})

      await advanceTime({seconds: 10000})

      expect(await stakingRewards.earnedSinceLastCheckpoint(tokenId)).to.bignumber.equal(new BN(0))
      await expectAction(() => stakingRewards.getReward(tokenId, {from: investor})).toChange([
        [() => gfi.balanceOf(investor), {unchanged: true}],
        [() => stakingRewards.earnedSinceLastCheckpoint(tokenId), {unchanged: true}],
      ])
    })

    it("checkpoints rewards before unstaking", async () => {
      const tokenId = await stake({amount: fiduAmount, from: investor})

      await advanceTime({seconds: 10000})

      await stakingRewards.unstake(tokenId, fiduAmount, {from: investor})

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("emits an Unstaked event", async () => {
      const tokenId = await stake({amount: fiduAmount, from: investor})
      const receipt = await stakingRewards.unstake(tokenId, fiduAmount, {from: investor})

      const unstakedEvent = getFirstLog<Unstaked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Unstaked"))

      expect(unstakedEvent.args.user).to.equal(investor)
      expect(unstakedEvent.args.tokenId).to.bignumber.equal(tokenId)
      expect(unstakedEvent.args.amount).to.bignumber.equal(fiduAmount)
    })

    context("for an old position with unsafeEffectiveMultiplier = 0", async () => {
      it("correctly updates the total staked supply", async () => {
        // Stake
        const tokenId = await stake({amount: fiduAmount, from: investor})

        // Check total staked supply after staking
        const prevTotalStakedSupply = await stakingRewards.totalStakedSupply()

        // Fake a pre-GIP-1 position by overriding the unsafeEffectiveMultiplier to 0
        await stakingRewards._setPositionUnsafeEffectiveMultiplier(tokenId, new BN(0))

        await advanceTime({seconds: 10000})

        // Unstake
        await stakingRewards.unstake(tokenId, fiduAmount, {from: investor})

        // The difference in the total staked supply should be exactly equal to fiduAmount
        const newTotalStakedSupply = await stakingRewards.totalStakedSupply()
        expect(prevTotalStakedSupply.sub(newTotalStakedSupply)).to.bignumber.equal(fiduAmount)
      })
    })

    context("user does not own position token and is not approved", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: anotherUser})).to.be.rejectedWith(/AD/)
      })
    })

    context("user is approved", async () => {
      it("succeeds", async () => {
        const tokenId = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await stakingRewards.approve(anotherUser, tokenId, {from: investor})

        await expectAction(() => stakingRewards.unstake(tokenId, fiduAmount, {from: anotherUser})).toChange([
          [() => fidu.balanceOf(anotherUser), {by: fiduAmount}],
          [() => stakingRewards.totalStakedSupply(), {by: fiduAmount.neg()}],
        ])
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: bigVal(100), from: investor})
        await stakingRewards.pause()
        await expect(stakingRewards.unstake(tokenId, bigVal(100), {from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("addToStake", async () => {
    let rewardRate: BN
    let totalRewards: BN

    beforeEach(async () => {
      rewardRate = bigVal(1000)

      // Fix the reward rate
      await stakingRewards.setRewardsParameters(
        targetCapacity,
        rewardRate,
        rewardRate,
        minRateAtPercent,
        maxRateAtPercent
      )

      // Mint rewards for a full year
      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)
    })

    it("can only be called by approved user or owner", async () => {
      await stake({amount: fiduAmount.div(new BN(2)), from: investor})

      await expect(stakingRewards.addToStake(1, bigVal(100), {from: anotherUser})).to.be.rejectedWith(/AD/)
    })

    it("can only be called for fidu positions", async () => {
      const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})

      await erc20Approve(usdc, seniorPool.address, usdcVal(1000), [owner])
      const receipt = await seniorPool.deposit(usdcVal(1000), {from: owner})
      const depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
      const ownerFiduAmount = depositEvent.args.shares

      await erc20Approve(fidu, stakingRewards.address, ownerFiduAmount, [owner])
      await stakingRewards.approve(owner, tokenId, {from: investor})

      await expect(stakingRewards.addToStake(tokenId, ownerFiduAmount, {from: owner})).to.be.rejectedWith(/PT/)
    })

    it("adds to stake without affecting vesting schedule", async () => {
      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

      let tokenId
      {
        const receipt = await stakingRewards.stakeWithVesting(
          investor,
          investor,
          fiduAmount.div(new BN(2)),
          StakedPositionType.Fidu,
          {
            from: investor,
          }
        )
        const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
        tokenId = stakedEvent.args.tokenId
      }

      await expectAction(() =>
        stakingRewards.addToStake(tokenId, fiduAmount.div(new BN(2)), {from: investor})
      ).toChange([
        // It adds to the tokenId's position
        [async () => ((await stakingRewards.positions(tokenId)) as any).amount, {by: fiduAmount.div(new BN(2))}],
        // It increases totalStakedSupply
        [() => stakingRewards.totalStakedSupply(), {by: fiduAmount.div(new BN(2))}],
      ])

      // It checkpoints rewards
      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("adds to stake without affecting vesting schedule (zapper)", async () => {
      let tokenId
      {
        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
        const receipt = await stakingRewards.stakeWithVesting(investor, investor, fiduAmount, StakedPositionType.Fidu, {
          from: investor,
        })
        const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
        tokenId = stakedEvent.args.tokenId
      }

      await erc20Approve(usdc, seniorPool.address, usdcVal(1000), [owner])
      const receipt = await seniorPool.deposit(usdcVal(1000), {from: owner})
      const depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
      const ownerFiduAmount = depositEvent.args.shares

      // It reverts if Zapper is not approved
      await expect(stakingRewards.addToStake(tokenId, ownerFiduAmount, {from: owner})).to.be.rejectedWith(/AD/)

      await erc20Approve(fidu, stakingRewards.address, ownerFiduAmount, [owner])
      await stakingRewards.approve(owner, tokenId, {from: investor})

      await expectAction(() => stakingRewards.addToStake(tokenId, ownerFiduAmount, {from: owner})).toChange([
        // It adds to the tokenId's position
        [async () => ((await stakingRewards.positions(tokenId)) as any).amount, {by: ownerFiduAmount}],
        // It increases totalStakedSupply
        [() => stakingRewards.totalStakedSupply(), {by: ownerFiduAmount}],
      ])

      // It checkpoints rewards
      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("adds to stake for non-vesting positions", async () => {
      const tokenId = await stake({amount: fiduAmount.div(new BN(2)), from: investor})

      await fidu.approve(stakingRewards.address, fiduAmount.div(new BN(2)), {from: investor})
      await expectAction(() =>
        stakingRewards.addToStake(tokenId, fiduAmount.div(new BN(2)), {from: investor})
      ).toChange([
        // It adds to the tokenId's position
        [async () => ((await stakingRewards.positions(tokenId)) as any).amount, {by: fiduAmount.div(new BN(2))}],
        // It increases totalStakedSupply
        [() => stakingRewards.totalStakedSupply(), {by: fiduAmount.div(new BN(2))}],
      ])

      // It checkpoints rewards
      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("adds to stake for non-vesting positions (zapper)", async () => {
      const tokenId = await stake({amount: fiduAmount.div(new BN(2)), from: investor})

      await erc20Approve(usdc, seniorPool.address, usdcVal(1000), [owner])
      const receipt = await seniorPool.deposit(usdcVal(1000), {from: owner})
      const depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
      const ownerFiduAmount = depositEvent.args.shares

      // It reverts if Zapper is not approved
      await expect(stakingRewards.addToStake(tokenId, ownerFiduAmount, {from: owner})).to.be.rejectedWith(/AD/)

      await erc20Approve(fidu, stakingRewards.address, ownerFiduAmount, [owner])
      await stakingRewards.approve(owner, tokenId, {from: investor})

      await expectAction(() => stakingRewards.addToStake(tokenId, ownerFiduAmount, {from: owner})).toChange([
        // It adds to the tokenId's position
        [async () => ((await stakingRewards.positions(tokenId)) as any).amount, {by: ownerFiduAmount}],
        // It increases totalStakedSupply
        [() => stakingRewards.totalStakedSupply(), {by: ownerFiduAmount}],
      ])

      // It checkpoints rewards
      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("paused", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: bigVal(100), from: investor})
        await stakingRewards.pause()
        await expect(stakingRewards.addToStake(tokenId, bigVal(100), {from: owner})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("unstakeMultiple", async () => {
    let totalRewards: BN
    let rewardRate: BN
    let firstToken: BN, secondToken: BN, thirdToken: BN, fourthToken: BN, fifthTokenFromDifferentUser: BN
    let firstTokenAmount: BN, secondTokenAmount: BN, thirdTokenAmount: BN, fourthTokenAmount: BN, fifthTokenAmount: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      rewardRate = bigVal(100)

      // Fix the reward rate
      await stakingRewards.setRewardsParameters(
        targetCapacity,
        rewardRate,
        rewardRate,
        minRateAtPercent,
        maxRateAtPercent
      )

      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Set up stakes
      firstTokenAmount = fiduAmount.mul(new BN(3)).div(new BN(4))
      firstToken = await stake({amount: firstTokenAmount, from: investor})

      secondTokenAmount = fiduAmount.mul(new BN(1)).div(new BN(4))
      secondToken = await stake({amount: secondTokenAmount, from: investor})

      thirdTokenAmount = curveLPAmount.mul(new BN(3)).div(new BN(4))
      thirdToken = await stake({amount: thirdTokenAmount, positionType: StakedPositionType.CurveLP, from: investor})

      fourthTokenAmount = curveLPAmount.mul(new BN(1)).div(new BN(4))
      fourthToken = await stake({amount: fourthTokenAmount, positionType: StakedPositionType.CurveLP, from: investor})

      fifthTokenAmount = fiduAmount.mul(new BN(4))
      fifthTokenFromDifferentUser = await stake({amount: fifthTokenAmount, from: anotherUser})
    })

    it("unstakes multiple fidu positions", async () => {
      await expectAction(() =>
        stakingRewards.unstakeMultiple([firstToken, secondToken], [firstTokenAmount, secondTokenAmount], {
          from: investor,
        })
      ).toChange([
        [() => seniorPool.assets(), {by: new BN(0)}],
        [() => fidu.balanceOf(investor), {by: firstTokenAmount.add(secondTokenAmount)}],
        [() => stakingRewards.totalStakedSupply(), {by: firstTokenAmount.add(secondTokenAmount).neg()}],
      ])
      await expect(
        stakingRewards.unstakeMultiple([firstToken, secondToken], [firstTokenAmount, secondTokenAmount], {
          from: investor,
        })
      ).to.be.rejectedWith(/IA/)
    })

    it("unstakes multiple curve positions", async () => {
      await expectAction(() =>
        stakingRewards.unstakeMultiple([thirdToken, fourthToken], [thirdTokenAmount, fourthTokenAmount], {
          from: investor,
        })
      ).toChange([
        [() => seniorPool.assets(), {by: new BN(0)}],
        [() => fiduUSDCCurveLP.balanceOf(investor), {by: thirdTokenAmount.add(fourthTokenAmount)}],
        [() => stakingRewards.totalStakedSupply(), {by: thirdTokenAmount.add(fourthTokenAmount).neg()}],
      ])

      await expect(
        stakingRewards.unstakeMultiple([thirdToken, fourthToken], [thirdTokenAmount, fourthTokenAmount], {
          from: investor,
        })
      ).to.be.rejectedWith(/IA/)
    })

    it("unstakes for multiple fidu and curve tokens", async () => {
      await expectAction(() =>
        stakingRewards.unstakeMultiple(
          [firstToken, secondToken, thirdToken, fourthToken],

          [firstTokenAmount, secondTokenAmount, thirdTokenAmount, fourthTokenAmount],
          {
            from: investor,
          }
        )
      ).toChange([
        [() => seniorPool.assets(), {by: new BN(0)}],
        [() => fidu.balanceOf(investor), {by: firstTokenAmount.add(secondTokenAmount)}],
        [() => fiduUSDCCurveLP.balanceOf(investor), {by: thirdTokenAmount.add(fourthTokenAmount)}],
        [
          () => stakingRewards.totalStakedSupply(),
          {by: firstTokenAmount.add(secondTokenAmount).add(thirdTokenAmount).add(fourthTokenAmount).neg()},
        ],
      ])
      await expect(
        stakingRewards.unstakeMultiple([firstToken, secondToken], [firstTokenAmount, secondTokenAmount], {
          from: investor,
        })
      ).to.be.rejectedWith(/IA/)
    })

    it("checkpoints rewards before unstaking", async () => {
      await stakingRewards.unstakeMultiple([firstToken, thirdToken], [firstTokenAmount, thirdTokenAmount], {
        from: investor,
      })

      await advanceTime({seconds: 10000})

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("emits an UnstakedMultiple event", async () => {
      const receipt = await stakingRewards.unstakeMultiple(
        [firstToken, thirdToken],
        [firstTokenAmount, thirdTokenAmount],
        {from: investor}
      )

      const unstakedMultipleEvent = getFirstLog<UnstakedMultiple>(
        decodeLogs(receipt.receipt.rawLogs, stakingRewards, "UnstakedMultiple")
      )

      expect(unstakedMultipleEvent.args.user).to.equal(investor)
      expect(unstakedMultipleEvent.args.tokenIds.length).to.equal(2)
      expect(unstakedMultipleEvent.args.tokenIds[0]).to.bignumber.equal(firstToken)
      expect(unstakedMultipleEvent.args.tokenIds[1]).to.bignumber.equal(thirdToken)
      expect(unstakedMultipleEvent.args.amounts.length).to.equal(2)
      expect(unstakedMultipleEvent.args.amounts[0]).to.bignumber.equal(firstTokenAmount)
      expect(unstakedMultipleEvent.args.amounts[1]).to.bignumber.equal(thirdTokenAmount)
    })

    describe("validations", async () => {
      context("user does not own position token and is not approved", async () => {
        it("reverts", async () => {
          await expect(
            stakingRewards.unstakeMultiple(
              [firstToken, secondToken, fifthTokenFromDifferentUser],
              [firstTokenAmount, secondTokenAmount, fifthTokenAmount],
              {from: investor}
            )
          ).to.be.rejectedWith(/AD/)
        })
      })

      context("user is approved", async () => {
        it("succeeds", async () => {
          await stakingRewards.approve(investor, fifthTokenFromDifferentUser, {from: anotherUser})

          await expect(
            stakingRewards.unstakeMultiple(
              [firstToken, secondToken, fifthTokenFromDifferentUser],
              [firstTokenAmount, secondTokenAmount, fifthTokenAmount],
              {from: investor}
            )
          ).to.not.be.rejected
        })
      })

      context("paused", async () => {
        it("reverts", async () => {
          await stakingRewards.pause()
          await expect(
            stakingRewards.unstakeMultiple([firstToken, thirdToken], [firstTokenAmount, thirdTokenAmount], {
              from: investor,
            })
          ).to.be.rejectedWith(/paused/)
        })
      })

      context("any amount exceeds withdrawable amount for that token", async () => {
        it("reverts", async () => {
          await expect(
            stakingRewards.unstakeMultiple(
              [firstToken, thirdToken],
              [firstTokenAmount, thirdTokenAmount.add(new BN(100))],
              {from: investor}
            )
          ).to.be.rejectedWith(/IA/)
        })
      })

      context("tokenIds and amounts lengths mismatch", async () => {
        it("reverts", async () => {
          await expect(
            stakingRewards.unstakeMultiple([firstToken, thirdToken], [firstTokenAmount], {
              from: investor,
            })
          ).to.be.rejectedWith(/LEN/)
        })
      })
    })
  })

  describe("getReward", async () => {
    let totalRewards: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)
    })

    it("transfers rewards to the user", async () => {
      const tokenId = await stake({amount: fiduAmount, from: investor})

      let timeInPool = new BN(10000)
      await advanceTime({seconds: timeInPool})

      await expectAction(() => stakingRewards.getReward(tokenId, {from: investor})).toChange([
        [() => gfi.balanceOf(investor), {by: maxRate.mul(timeInPool)}],
      ])

      timeInPool = new BN(100)
      await advanceTime({seconds: timeInPool})

      // Subsequent claiming of rewards should only account for time since last claim
      await expectAction(() => stakingRewards.getReward(tokenId, {from: investor}), true).toChange([
        [() => gfi.balanceOf(investor), {by: maxRate.mul(timeInPool)}],
      ])
    })

    context("user does not own position token", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await expect(stakingRewards.getReward(tokenId, {from: anotherUser})).to.be.rejectedWith(/AD/)
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: bigVal(100), from: investor})
        await advanceTime({seconds: 10000})
        await stakingRewards.pause()
        await expect(stakingRewards.getReward(tokenId, {from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("totalStakedSupply", async () => {
    it("returns the total unleveraged staked supply", async () => {
      await stake({amount: fiduAmount, from: anotherUser})
      await stake({amount: fiduAmount, from: investor})

      expect(await stakingRewards.totalStakedSupply()).to.bignumber.eq(fiduAmount.mul(new BN(2)))
    })
  })

  describe("stakedBalanceOf", async () => {
    it("returns the unlevered staked balance of a given position token", async () => {
      const tokenId = await stake({amount: fiduAmount, from: anotherUser})

      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.eq(fiduAmount)
    })
  })

  describe("rewardPerToken", async () => {
    it("returns the accumulated rewards per token up to the current block timestamp", async () => {
      const rewardRate = new BN(String(1e18))
      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(
        targetCapacity,
        rewardRate,
        rewardRate,
        minRateAtPercent,
        maxRateAtPercent
      )

      const totalRewards = rewardRate.mul(yearInSeconds.mul(new BN(2)))
      await mintRewards(totalRewards)

      await advanceTime({seconds: 10000})
      await ethers.provider.send("evm_mine", [])

      // It should be 0 when there is no staking supply
      expect(await stakingRewards.rewardPerToken()).to.bignumber.equal(new BN(0))

      await stake({amount: fiduAmount, from: investor})

      await advanceTime({seconds: 10000})
      await ethers.provider.send("evm_mine", [])

      const expectedRewards = rewardRate
        .mul(new BN(10000))
        .mul(new BN(String(1e18)))
        .div(fiduAmount)
      expect(await stakingRewards.rewardPerToken()).to.bignumber.equal(expectedRewards)

      await advanceTime({seconds: 25000})
      await ethers.provider.send("evm_mine", [])

      expect(await stakingRewards.rewardPerToken()).to.bignumber.equal(
        expectedRewards.add(
          rewardRate
            .mul(new BN(25000))
            .mul(new BN(String(1e18)))
            .div(fiduAmount)
        )
      )
    })

    context("computed rewardPerToken is greater than reward supply", async () => {
      it("caps rewardPerToken at reward supply", async () => {
        const rewardRate = new BN(String(1e18))
        // Fix the reward rate to make testing easier
        await stakingRewards.setRewardsParameters(
          targetCapacity,
          rewardRate,
          rewardRate,
          minRateAtPercent,
          maxRateAtPercent
        )

        // Mint rewards for one year
        const totalRewards = rewardRate.mul(yearInSeconds)
        await mintRewards(totalRewards)

        await stake({amount: fiduAmount, from: anotherUser})

        // Stake for two years
        await advanceTime({seconds: yearInSeconds.mul(new BN(2))})
        await ethers.provider.send("evm_mine", [])

        // rewardPerToken should max out at totalRewards, despite staking for longer
        expect(await stakingRewards.rewardPerToken()).to.bignumber.equal(
          totalRewards.mul(new BN(String(1e18))).div(fiduAmount)
        )
      })
    })

    context("reward rate changes", async () => {
      it("uses the updated reward rate", async () => {
        const rewardRate1 = new BN(String(2e18))
        // Fix the reward rate to make testing easier
        await stakingRewards.setRewardsParameters(
          targetCapacity,
          rewardRate1,
          rewardRate1,
          minRateAtPercent,
          maxRateAtPercent
        )

        // Mint rewards for one year
        const totalRewards = rewardRate1.mul(yearInSeconds)
        await mintRewards(totalRewards)

        await stake({amount: fiduAmount, from: anotherUser})

        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        // Lower the reward rate
        const rewardRate2 = new BN(String(1e18))
        await stakingRewards.setRewardsParameters(
          targetCapacity,
          rewardRate2,
          rewardRate2,
          minRateAtPercent,
          maxRateAtPercent
        )

        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        const expectedRewards = rewardRate1
          .mul(halfYearInSeconds)
          .add(rewardRate2.mul(halfYearInSeconds))
          .mul(new BN(String(1e18)))
          .div(fiduAmount)

        // Threshold of 5 seconds of rewards to account for slight block.timestamp increase when setting
        // min/max rate
        const threshold = new BN(5)
          .mul(rewardRate1)
          .mul(new BN(String(1e18)))
          .div(fiduAmount)

        expect(await stakingRewards.rewardPerToken()).to.bignumber.closeTo(expectedRewards, threshold)
      })
    })
  })

  describe("earnedSinceLastCheckpoint", async () => {
    let rewardRate: BN

    beforeEach(async function () {
      rewardRate = new BN(String(2e18))
      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(
        targetCapacity,
        rewardRate,
        rewardRate,
        minRateAtPercent,
        maxRateAtPercent
      )

      // Mint rewards for one year
      const totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)
    })

    it("returns the rewards earned for a given tokenId since the last checkpoint", async () => {
      const tokenId = await stake({amount: fiduAmount, from: investor})

      await advanceTime({seconds: halfYearInSeconds})
      await ethers.provider.send("evm_mine", [])

      expect(await stakingRewards.earnedSinceLastCheckpoint(tokenId)).to.bignumber.equal(
        rewardRate.mul(halfYearInSeconds)
      )

      await advanceTime({seconds: halfYearInSeconds})
      await stakingRewards.getReward(tokenId, {from: investor})

      // It should return 0, since the last checkpoint occcured in the current block
      expect(await stakingRewards.earnedSinceLastCheckpoint(tokenId)).to.bignumber.equal(new BN(0))
    })
  })

  describe("currentEarnRatePerToken", async () => {
    let rewardRate: BN

    beforeEach(async function () {
      rewardRate = new BN(String(2e18))
      await stakingRewards.setRewardsParameters(
        targetCapacity,
        rewardRate,
        rewardRate,
        minRateAtPercent,
        maxRateAtPercent
      )

      const totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)
    })

    context("`lastUpdateTime` is in the past", () => {
      it("returns the rewards earned per second for staking one FIDU token", async () => {
        await stake({amount: fiduAmount, from: anotherUser})
        await stake({amount: fiduAmount, from: anotherUser})

        const timestampAfterStaking = await getCurrentTimestamp()

        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        const currentTimestamp = await getCurrentTimestamp()
        expect(currentTimestamp).to.bignumber.equal(timestampAfterStaking.add(halfYearInSeconds))
        const lastUpdateTime = await stakingRewards.lastUpdateTime()
        expect(lastUpdateTime).to.bignumber.equal(timestampAfterStaking)

        const expectedTotalLeveragedStakedSupply = fiduAmount.mul(new BN(2))
        expect(await stakingRewards.currentEarnRatePerToken()).to.bignumber.equal(
          rewardRate.mul(halfYearInSeconds).mul(decimals).div(expectedTotalLeveragedStakedSupply).div(halfYearInSeconds)
        )
      })
    })

    context("`lastUpdateTime` is the current timestamp", () => {
      it("returns the rewards earned per second for staking one FIDU token", async () => {
        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        await stake({amount: fiduAmount, from: anotherUser})
        await stake({amount: fiduAmount, from: anotherUser})
        const timestampAfterStaking = await getCurrentTimestamp()

        const lastUpdateTime = await stakingRewards.lastUpdateTime()
        expect(lastUpdateTime).to.bignumber.equal(timestampAfterStaking)

        const expectedTotalLeveragedStakedSupply = fiduAmount.mul(new BN(2))
        expect(await stakingRewards.currentEarnRatePerToken()).to.bignumber.equal(
          rewardRate.mul(decimals).div(expectedTotalLeveragedStakedSupply)
        )
      })
    })
  })

  describe("positionCurrentEarnRate", async () => {
    let rewardRate: BN

    beforeEach(async function () {
      rewardRate = new BN(String(2e18))
      await stakingRewards.setRewardsParameters(
        targetCapacity,
        rewardRate,
        rewardRate,
        minRateAtPercent,
        maxRateAtPercent
      )

      const totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)
    })

    context("`lastUpdateTime` is in the past", () => {
      it("returns the rewards earned per second for the position", async () => {
        const tokenId = await stake({amount: fiduAmount, from: anotherUser})
        await stake({amount: fiduAmount, from: anotherUser})

        const timestampAfterStaking = await getCurrentTimestamp()

        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        const currentTimestamp = await getCurrentTimestamp()
        expect(currentTimestamp).to.bignumber.equal(timestampAfterStaking.add(halfYearInSeconds))
        const lastUpdateTime = await stakingRewards.lastUpdateTime()
        expect(lastUpdateTime).to.bignumber.equal(timestampAfterStaking)

        const expectedTotalLeveragedStakedSupply = fiduAmount.mul(new BN(2))
        expect(await stakingRewards.positionCurrentEarnRate(tokenId)).to.bignumber.equal(
          rewardRate
            .mul(halfYearInSeconds)
            .mul(fiduAmount)
            .div(expectedTotalLeveragedStakedSupply)
            .div(halfYearInSeconds)
        )
      })
    })

    context("`lastUpdateTime` is the current timestamp", () => {
      it("returns the rewards earned per second for staking one FIDU token", async () => {
        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        const tokenId = await stake({amount: fiduAmount, from: anotherUser})
        await stake({amount: fiduAmount, from: anotherUser})
        const timestampAfterStaking = await getCurrentTimestamp()

        const lastUpdateTime = await stakingRewards.lastUpdateTime()
        expect(lastUpdateTime).to.bignumber.equal(timestampAfterStaking)

        const expectedTotalLeveragedStakedSupply = fiduAmount.mul(new BN(2))
        expect(await stakingRewards.positionCurrentEarnRate(tokenId)).to.bignumber.equal(
          rewardRate.mul(fiduAmount).div(expectedTotalLeveragedStakedSupply)
        )
      })
    })
  })

  describe("setEffectiveMultiplier", async () => {
    beforeEach(async () => {
      // Mint rewards for a full year
      const totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)

      // Reset effective multiplier to 1x
      await stakingRewards.setEffectiveMultiplier(new BN(1).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)
    })

    it("the default effective multiplier is correct", async () => {
      // Set the effective multiplier to the default value in the deploy script
      await stakingRewards.setEffectiveMultiplier("750000000000000000", StakedPositionType.CurveLP)

      // Investor stakes
      const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})

      const position = await stakingRewards.positions(tokenId)
      expect(position[5]).to.bignumber.equal(MULTIPLIER_DECIMALS.mul(new BN(75)).div(new BN(100)))

      expect(await stakingRewards.totalStakedSupply()).to.bignumber.equal(bigVal(75))
    })
  })

  describe("updatePositionEffectiveMultiplier", async () => {
    beforeEach(async () => {
      // Mint rewards for a full year
      const totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)

      // Reset effective multiplier to 1x
      await stakingRewards.setEffectiveMultiplier(new BN(1).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)
    })

    it("checkpoints rewards before updating the position's multiplier", async () => {
      // Investor stakes
      const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})

      // The effective multiplier is updated
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)

      // Trigger updating the position's effective multiplier
      await stakingRewards.updatePositionEffectiveMultiplier(tokenId, {from: investor})

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("updates the position's multiplier", async () => {
      // Investor stakes
      const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})

      // The effective multiplier is updated
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)

      let position = await stakingRewards.positions(tokenId)
      expect(position[5]).to.bignumber.equal(MULTIPLIER_DECIMALS)

      // Trigger updating the position's effective multiplier
      await stakingRewards.updatePositionEffectiveMultiplier(tokenId, {from: investor})

      position = await stakingRewards.positions(tokenId)
      expect(position[5]).to.bignumber.equal(new BN(2).mul(MULTIPLIER_DECIMALS))
    })

    it("recalculates the total staked supply", async () => {
      // Another user stakes
      await stake({
        amount: curveLPAmount,
        from: anotherUser,
      })

      // Investor stakes
      const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})

      // The effective multiplier is updated
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)

      let totalStakedSupply = await stakingRewards.totalStakedSupply()
      expect(totalStakedSupply).to.bignumber.equal(curveLPAmount.mul(new BN(2)))

      // Trigger updating the position's effective multiplier
      await stakingRewards.updatePositionEffectiveMultiplier(tokenId, {from: investor})

      totalStakedSupply = await stakingRewards.totalStakedSupply()
      expect(totalStakedSupply).to.bignumber.equal(curveLPAmount.mul(new BN(3)))
    })

    it("distributes rewards based on new multiplier", async () => {
      // Threshold of 5 seconds of rewards to account for slight block.timestamp increases
      const threshold = new BN(10).mul(maxRate)

      // anotherUser stakes the same number of FIDU tokens
      const anotherUserToken = await stake({
        amount: curveLPAmount,
        from: anotherUser,
      })
      const startAt = await time.latest()

      // investor stakes
      const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
      const investorStakedAt = await time.latest()
      const timeDiff = investorStakedAt.sub(startAt)

      // the effective multiplier is updated
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)

      await advanceTime({seconds: halfYearInSeconds})

      // investor owns 1/2 of the staked supply and therefore should receive 1/2
      // of the disbursed rewards
      await stakingRewards.getReward(tokenId, {from: investor})
      let expectedRewards = maxRate.mul(halfYearInSeconds).div(new BN(2))
      let gfiInvestorBalance = await gfi.balanceOf(investor)
      expect(gfiInvestorBalance).to.bignumber.closeTo(expectedRewards, threshold)

      // anotherUser owns 1/2 of the staked supply and therefore should receive 1/2
      // of the disbursed rewards
      await stakingRewards.getReward(anotherUserToken, {from: anotherUser})
      const rewardsWhenOnlyAnotherUserWasStaked = maxRate.mul(timeDiff)
      expectedRewards = expectedRewards.add(rewardsWhenOnlyAnotherUserWasStaked)
      let gfiAnotherUser = await gfi.balanceOf(anotherUser)
      expect(gfiAnotherUser).to.bignumber.closeTo(expectedRewards, threshold)

      // Trigger updating the position's effective multiplier
      await stakingRewards.updatePositionEffectiveMultiplier(tokenId, {from: investor})

      await advanceTime({seconds: halfYearInSeconds})

      // investor owns 2/3 of the staked supply and therefore should receive 2/3
      // of the disbursed rewards from the second half of the year
      await stakingRewards.getReward(tokenId, {from: investor})
      const prevGfiInvestorBalance = gfiInvestorBalance
      gfiInvestorBalance = await gfi.balanceOf(investor)
      expectedRewards = maxRate.mul(halfYearInSeconds).mul(new BN(2)).div(new BN(3))
      expect(gfiInvestorBalance.sub(prevGfiInvestorBalance)).to.bignumber.closeTo(expectedRewards, threshold)

      // anotherUser owns 1/3 of the staked supply and therefore should receive 1/3
      // of the disbursed rewards from the second half of the year
      await stakingRewards.getReward(anotherUserToken, {from: anotherUser})
      const prevGfiAnotherUserBalance = gfiAnotherUser
      gfiAnotherUser = await gfi.balanceOf(anotherUser)
      expectedRewards = maxRate.mul(halfYearInSeconds).div(new BN(3))
      expect(gfiAnotherUser.sub(prevGfiAnotherUserBalance)).to.bignumber.closeTo(expectedRewards, threshold)
    })

    context("for an old position with unsafeEffectiveMultiplier = 0", async () => {
      it("does not affect the total staked supply", async () => {
        // Investor stakes
        const tokenId = await stake({amount: fiduAmount, positionType: StakedPositionType.Fidu, from: investor})

        const _position = await stakingRewards.positions(tokenId)
        expect(_position[5]).to.bignumber.equal(MULTIPLIER_DECIMALS)

        // Fake an old position by overriding the position's unsafe effective multiplier to 0
        await stakingRewards._setPositionUnsafeEffectiveMultiplier(tokenId, new BN(0))

        const positionBefore = await stakingRewards.positions(tokenId)
        expect(positionBefore[5]).to.bignumber.equal(new BN(0))

        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
        expect(totalStakedSupplyBefore).to.bignumber.equal(fiduAmount)

        // Trigger updating the position's effective multiplier
        await stakingRewards.updatePositionEffectiveMultiplier(tokenId, {from: investor})

        const positionAfter = await stakingRewards.positions(tokenId)
        expect(positionAfter[5]).to.bignumber.equal(MULTIPLIER_DECIMALS)

        // The total staked supply should not be affected
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()
        expect(totalStakedSupplyAfter).to.bignumber.equal(totalStakedSupplyBefore)
      })
    })
  })

  describe("market-based rewards", async () => {
    let totalRewards: BN
    const maxRate = bigVal(10)
    const minRate = bigVal(1)
    const maxRateAtPercent = new BN(String(5e17))
    const minRateAtPercent = bigVal(3)
    const targetCapacity = bigVal(500)

    beforeEach(async () => {
      await stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent)

      // Mint rewards for a full year
      totalRewards = maxRate.mul(yearInSeconds)

      await mintRewards(totalRewards)
    })

    context("staked supply is below maxRateAtPercent", async () => {
      it("grants the max rate", async () => {
        const amount = targetCapacity
          .mul(maxRateAtPercent)
          .div(new BN(String(1e18)))
          .sub(new BN(String(1e18)))
        const tokenId = await stake({amount, from: investor})

        await advanceTime({seconds: yearInSeconds})
        await stakingRewards.getReward(tokenId, {from: investor})

        const threshold = new BN(String(1e3))
        expect(await gfi.balanceOf(investor)).to.bignumber.closeTo(maxRate.mul(yearInSeconds), threshold)
      })
    })

    context("staked supply is above minRateAtPercent", async () => {
      it("grants the min rate", async () => {
        const amount = targetCapacity
          .mul(minRateAtPercent)
          .div(new BN(String(1e18)))
          .add(new BN(String(1e18)))
        const tokenId = await stake({amount, from: investor})

        await advanceTime({seconds: yearInSeconds})
        await stakingRewards.getReward(tokenId, {from: investor})

        const threshold = new BN(String(1e3))
        expect(await gfi.balanceOf(investor)).to.bignumber.closeTo(minRate.mul(yearInSeconds), threshold)
      })
    })

    context("staked supply is in the target range", async () => {
      it("grants tokens linearly decreasing from max rate to min rate", async () => {
        const intervalStart = targetCapacity.mul(maxRateAtPercent).div(new BN(String(1e18)))
        const intervalEnd = targetCapacity.mul(minRateAtPercent).div(new BN(String(1e18)))

        const splits = 5
        const additionalAmount = intervalEnd.sub(intervalStart).div(new BN(splits))
        const duration = yearInSeconds.div(new BN(splits))

        const additionalRewardsRate = maxRate.sub(minRate).div(new BN(splits))

        let amountToStake = intervalStart

        // Test that rewards decrease linearly over 5 additional investments
        for (let i = 0; i < splits; i++) {
          const expectedRate = maxRate.sub(additionalRewardsRate.mul(new BN(i)))

          // Dividing by i + 1 to account for other staking positions
          const expectedRewards = expectedRate.mul(duration).div(new BN(i + 1))

          const tokenId = await stake({amount: amountToStake, from: investor})
          await advanceTime({seconds: duration})

          await expectAction(() => stakingRewards.getReward(tokenId, {from: investor})).toChange([
            [() => gfi.balanceOf(investor), {by: expectedRewards}],
          ])

          amountToStake = additionalAmount
        }
      })
    })
  })

  describe("perverse scenarios", async () => {
    let totalRewards: BN

    context("total rewards available less than reward rate", async () => {
      beforeEach(async function () {
        // Mint rewards for a full year
        totalRewards = maxRate.mul(yearInSeconds)
        await mintRewards(totalRewards)

        // Fix the reward rate to make testing easier
        await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)
      })

      it("grants rewards up to available rewards", async () => {
        const tokenId1 = await stake({amount: fiduAmount, from: anotherUser})

        await advanceTime({seconds: 300})

        const tokenId2 = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: yearInSeconds.mul(new BN(2))})

        await stakingRewards.getReward(tokenId1, {from: anotherUser})
        await stakingRewards.getReward(tokenId2, {from: investor})

        const gfiBalance = (await gfi.balanceOf(investor)).add(await gfi.balanceOf(anotherUser))
        expect(gfiBalance).to.bignumber.equal(totalRewards)
      })
    })

    context("staked supply is a fraction of 1 token", async () => {
      beforeEach(async function () {
        // Mint rewards for a full year
        totalRewards = maxRate.mul(yearInSeconds)
        await mintRewards(totalRewards)

        // Fix the reward rate to make testing easier
        await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)
      })

      it("does not disburse any rewards", async () => {
        // 0.000000000000050000 fidu
        const fiduAmount = new BN(5e4)
        const tokenId = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 1000})

        await expectAction(() => stakingRewards.getReward(tokenId, {from: investor})).toChange([
          [() => gfi.balanceOf(investor), {unchanged: true}],
          [() => stakingRewards.earnedSinceLastCheckpoint(tokenId), {unchanged: true}],
        ])
      })
    })

    context("user transfers NFT", async () => {
      beforeEach(async function () {
        // Mint rewards for a full year
        totalRewards = maxRate.mul(yearInSeconds)
        await mintRewards(totalRewards)

        // Fix the reward rate to make testing easier
        await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)
      })

      it("does not affect rewards", async () => {
        const tokenId = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: halfYearInSeconds})

        await stakingRewards.getReward(tokenId, {from: investor})
        const startTime = await time.latest()

        await stakingRewards.approve(anotherUser, tokenId, {from: investor})
        await stakingRewards.transferFrom(investor, anotherUser, tokenId, {from: investor})

        await stakingRewards.getReward(tokenId, {from: anotherUser})
        const timeDiff = (await time.latest()).sub(startTime)

        // anotherUser should only be able to claim rewards that have accrued since the last claim
        expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(maxRate.mul(timeDiff))
      })
    })
  })

  describe("removeReward", async () => {
    it("reverts when not owner", async () => {
      const [, , , , , notOwner] = await hre.getUnnamedAccounts()
      assertNonNullable(notOwner)
      const ownerRole = await stakingRewards.OWNER_ROLE()
      expect(await stakingRewards.hasRole(ownerRole, notOwner)).to.be.false

      await expect(stakingRewards.removeRewards("1000", {from: notOwner})).to.be.rejectedWith("AD")
    })

    describe("with rewards loaded", async () => {
      const rewardsToLoad = "100000000000000000000"
      const setup = deployments.createFixture(async () => {
        await gfi.mint(owner, rewardsToLoad)
        await gfi.approve(stakingRewards.address, rewardsToLoad)
        await stakingRewards.loadRewards(rewardsToLoad)
      })

      beforeEach(async () => {
        await setup()
      })

      it("checkpoints when called", async () => {
        await stakingRewards.removeRewards("1000")

        const lastUpdateTime = await stakingRewards.lastUpdateTime()
        const currentTime = await getCurrentTimestamp()
        expect(lastUpdateTime).to.eq(currentTime)
      })

      it("reverts if removing more rewards than are loaded", async () => {
        const rewardsToRemove = "100000000000000000001"
        expect(new BN(rewardsToRemove)).to.bignumber.greaterThan(new BN(rewardsToLoad))
        await expect(stakingRewards.removeRewards(rewardsToRemove)).to.be.rejectedWith("f")
      })

      it("succesfully removes rewards and emits an event", async () => {
        const rewardsToRemove = rewardsToLoad
        const gfiBalanceBefore = await gfi.balanceOf(stakingRewards.address)
        const rewardsAvailableBefore = await stakingRewards.rewardsAvailable()
        const receipt = await stakingRewards.removeRewards(rewardsToRemove)
        expectEvent(receipt, "RewardRemoved", {reward: rewardsToRemove})
        const gfiBalanceAfer = await gfi.balanceOf(stakingRewards.address)
        const rewardsAvailableAfter = await stakingRewards.rewardsAvailable()
        expect(gfiBalanceAfer).to.bignumber.eq(gfiBalanceBefore.sub(new BN(rewardsToRemove)))
        expect(rewardsAvailableAfter).to.bignumber.eq(rewardsAvailableBefore.sub(new BN(rewardsToRemove)))
      })
    })
  })

  describe("loadRewards", async () => {
    it("transfers rewards into contract", async () => {
      const amount = bigVal(1000)
      await gfi.mint(owner, amount)
      await gfi.approve(stakingRewards.address, amount)

      await expectAction(() => stakingRewards.loadRewards(amount)).toChange([
        [() => gfi.balanceOf(stakingRewards.address), {by: amount}],
        [() => gfi.balanceOf(owner), {by: amount.neg()}],
        [() => stakingRewards.rewardsAvailable(), {by: amount}],
      ])
    })

    it("emits an event", async () => {
      const amount = bigVal(1000)
      await gfi.mint(owner, amount)
      await gfi.approve(stakingRewards.address, amount)

      const receipt = await stakingRewards.loadRewards(amount)
      expectEvent(receipt, "RewardAdded", {reward: amount})
    })

    it("checkpoints rewards", async () => {
      const amount = bigVal(1000)
      await gfi.mint(owner, amount)
      await gfi.approve(stakingRewards.address, amount)

      await stakingRewards.loadRewards(amount)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(stakingRewards.loadRewards(bigVal(1000), {from: anotherUser})).to.be.rejectedWith(/AD/)
      })
    })
  })

  describe("setRewardsParameters", async () => {
    it("sets reward parameters", async () => {
      const newTargetCapacity = bigVal(1)
      const newMinRate = bigVal(12)
      const newMaxRate = bigVal(123)
      const newMinRateAtPercent = new BN(25).mul(new BN(String(1e18)))
      const newMaxRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      await stakingRewards.setRewardsParameters(
        newTargetCapacity,
        newMinRate,
        newMaxRate,
        newMinRateAtPercent,
        newMaxRateAtPercent
      )

      expect(await stakingRewards.targetCapacity()).to.bignumber.equal(newTargetCapacity)
      expect(await stakingRewards.minRate()).to.bignumber.equal(newMinRate)
      expect(await stakingRewards.maxRate()).to.bignumber.equal(newMaxRate)
      expect(await stakingRewards.minRateAtPercent()).to.bignumber.equal(newMinRateAtPercent)
      expect(await stakingRewards.maxRateAtPercent()).to.bignumber.equal(newMaxRateAtPercent)
    })

    it("emits an event", async () => {
      const newTargetCapacity = bigVal(1)
      const newMinRate = bigVal(12)
      const newMaxRate = bigVal(123)
      const newMinRateAtPercent = new BN(25).mul(new BN(String(1e18)))
      const newMaxRateAtPercent = new BN(25).mul(new BN(String(1e18)))
      const tx = await stakingRewards.setRewardsParameters(
        newTargetCapacity,
        newMinRate,
        newMaxRate,
        newMinRateAtPercent,
        newMaxRateAtPercent,
        {from: owner}
      )

      expectEvent(tx, "RewardsParametersUpdated", {
        who: owner,
        targetCapacity: newTargetCapacity,
        minRate: newMinRate,
        maxRate: newMaxRate,
        minRateAtPercent: newMinRateAtPercent,
        maxRateAtPercent: newMaxRateAtPercent,
      })
    })

    it("checkpoints rewards", async () => {
      const newTargetCapacity = bigVal(1234)
      await stakingRewards.setRewardsParameters(newTargetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("reverts if minRate > maxRate", async () => {
      const newMinRate = bigVal(1000)
      const newMaxRate = bigVal(100)
      await expect(
        stakingRewards.setRewardsParameters(targetCapacity, newMinRate, newMaxRate, minRateAtPercent, maxRateAtPercent)
      ).to.be.rejectedWith(/IP/)
    })

    it("reverts if maxRateAtPercent > minRateAtPercent", async () => {
      let newMinRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      let newMaxRateAtPercent = new BN(25).mul(new BN(String(1e18)))
      await expect(
        stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, newMinRateAtPercent, newMaxRateAtPercent)
      ).to.be.rejectedWith(/IP/)

      newMinRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      newMaxRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      await expect(
        stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, newMinRateAtPercent, newMaxRateAtPercent)
      ).to.be.fulfilled

      newMinRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      newMaxRateAtPercent = new BN(25).mul(new BN(String(1e15)))
      await expect(
        stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, newMinRateAtPercent, newMaxRateAtPercent)
      ).to.be.fulfilled
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        const newTargetCapacity = bigVal(1000)
        await expect(
          stakingRewards.setRewardsParameters(newTargetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent, {
            from: anotherUser,
          })
        ).to.be.rejectedWith(/AD/)
      })
    })
  })

  describe("getBaseTokenExchangeRate", async () => {
    context("for FIDU positions", async () => {
      it("is correct", async () => {
        expect(await stakingRewards.getBaseTokenExchangeRate(StakedPositionType.Fidu)).to.bignumber.equal(
          MULTIPLIER_DECIMALS
        )
      })
    })

    context("for Curve LP positions", async () => {
      it("is correct", async () => {
        // Reset balances such that 1 FIDU underlies a single Curve LP token
        await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS)
        await fiduUSDCCurveLP._setTotalSupply(MULTIPLIER_DECIMALS)
        expect(await stakingRewards.getBaseTokenExchangeRate(StakedPositionType.CurveLP)).to.bignumber.equal(
          MULTIPLIER_DECIMALS
        )

        // Reset balances such that 2 FIDU underlies a single Curve LP token
        await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS.mul(new BN(2)))
        await fiduUSDCCurveLP._setTotalSupply(MULTIPLIER_DECIMALS)
        expect(await stakingRewards.getBaseTokenExchangeRate(StakedPositionType.CurveLP)).to.bignumber.equal(
          MULTIPLIER_DECIMALS.mul(new BN(2))
        )

        // Reset balances such that 0.5 FIDU underlies a single Curve LP token
        await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS.div(new BN(2)))
        await fiduUSDCCurveLP._setTotalSupply(MULTIPLIER_DECIMALS)
        expect(await stakingRewards.getBaseTokenExchangeRate(StakedPositionType.CurveLP)).to.bignumber.equal(
          MULTIPLIER_DECIMALS.div(new BN(2))
        )
      })
    })
  })

  describe("setEffectiveMultiplier", async () => {
    beforeEach(async () => {
      // Mint rewards for a full year
      const totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setRewardsParameters(targetCapacity, maxRate, maxRate, minRateAtPercent, maxRateAtPercent)

      // Reset effective multiplier to 1x
      await stakingRewards.setEffectiveMultiplier(new BN(1).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)
    })

    it("sets multipliers", async () => {
      expect(await stakingRewards.getEffectiveMultiplierForPositionType(StakedPositionType.CurveLP)).to.bignumber.equal(
        bigVal(1)
      )
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)
      expect(await stakingRewards.getEffectiveMultiplierForPositionType(StakedPositionType.CurveLP)).to.bignumber.equal(
        bigVal(2)
      )
    })

    it("checkpoints rewards", async () => {
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    it("emits an event", async () => {
      const multiplier = new BN(2).mul(MULTIPLIER_DECIMALS)
      const tx = await stakingRewards.setEffectiveMultiplier(multiplier, StakedPositionType.CurveLP, {from: owner})
      expectEvent(tx, "EffectiveMultiplierUpdated", {
        who: owner,
        positionType: StakedPositionType.CurveLP.toString(),
        multiplier,
      })
    })

    it("does not affect previously staked positions", async () => {
      // anotherUser stakes the same number of FIDU tokens
      const anotherUserToken = await stake({
        amount: curveLPAmount,
        from: anotherUser,
      })
      const startTime = await time.latest()

      const tokenId = await stake({amount: curveLPAmount, positionType: StakedPositionType.CurveLP, from: investor})
      const timeDiff = (await time.latest()).sub(startTime)

      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)

      await advanceTime({seconds: yearInSeconds})

      // investor owns 1/2 of the staked supply and therefore should receive 1/2
      // of the disbursed rewards
      await stakingRewards.getReward(tokenId, {from: investor})
      let expectedRewards = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
      expect(await gfi.balanceOf(investor)).to.bignumber.equal(expectedRewards)

      // anotherUser owns 1/2 of the staked supply and therefore should receive 1/2
      // of the disbursed rewards
      await stakingRewards.getReward(anotherUserToken, {from: anotherUser})
      const rewardsWhenOnlyAnotherUserWasStaked = maxRate.mul(timeDiff)
      const rewardsWhenInvestorWasStaked = maxRate.mul(yearInSeconds.sub(timeDiff)).div(new BN(2))
      expectedRewards = rewardsWhenOnlyAnotherUserWasStaked.add(rewardsWhenInvestorWasStaked)
      expect(await gfi.balanceOf(anotherUser)).to.bignumber.equal(expectedRewards)
    })

    it("does not allow multiplier to be set to 0", async () => {
      await expect(stakingRewards.setEffectiveMultiplier(new BN(0), StakedPositionType.CurveLP)).to.be.rejectedWith(
        /ZERO/
      )
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(
          stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP, {
            from: anotherUser,
          })
        ).to.be.rejectedWith(/AD/)
      })
    })
  })
})

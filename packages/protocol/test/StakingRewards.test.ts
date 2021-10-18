/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
import {
  ERC20Instance,
  FiduInstance,
  GFIInstance,
  GoldfinchConfigInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
} from "../typechain/truffle"
const {ethers, deployments} = hre
import {DepositMade} from "../typechain/truffle/SeniorPool"
import {RewardPaid, Staked} from "../typechain/truffle/StakingRewards"
import {
  usdcVal,
  deployAllContracts,
  erc20Transfer,
  expect,
  decodeLogs,
  getFirstLog,
  erc20Approve,
  advanceTime,
  bigVal,
  expectAction,
  MAX_UINT,
} from "./testHelpers"
import {time, expectEvent} from "@openzeppelin/test-helpers"
import {getApprovalDigest, getWallet} from "./permitHelpers"
import {ecsign} from "ethereumjs-util"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"

// Typechain doesn't generate types for solidity enums, so redefining here
enum LockupPeriod {
  SixMonths,
  TwelveMonths,
  TwentyFourMonths,
}

async function quoteFiduToUSDC({
  fiduAmount,
  seniorPool,
}: {
  fiduAmount: BN
  seniorPool: SeniorPoolInstance
}): Promise<BN> {
  return fiduAmount
    .mul(await seniorPool.sharePrice())
    .div(new BN(String(1e18))) //share price mantissa
    .div(new BN(String(1e18)).div(new BN(String(1e6)))) // usdc mantissa
}

function withWithdrawalFee(usdcAmount: BN): BN {
  const seniorPoolWithdrawalFeeDenominator = new BN(200)
  return usdcAmount.sub(usdcAmount.div(seniorPoolWithdrawalFeeDenominator))
}

describe("StakingRewards", function () {
  let owner: string,
    investor: string,
    anotherUser: string,
    goldfinchConfig: GoldfinchConfigInstance,
    gfi: GFIInstance,
    usdc: ERC20Instance,
    seniorPool: SeniorPoolInstance,
    fidu: FiduInstance,
    stakingRewards: StakingRewardsInstance

  let fiduAmount: BN
  let anotherUserFiduAmount: BN

  let targetCapacity: BN
  let maxRate: BN
  let minRate: BN
  let maxRateAtPercent: BN
  let minRateAtPercent: BN

  const yearInSeconds = new BN(365 * 24 * 60 * 60)
  const halfYearInSeconds = yearInSeconds.div(new BN(2))

  const lockupPeriodToDuration = {
    [LockupPeriod.SixMonths]: halfYearInSeconds,
    [LockupPeriod.TwelveMonths]: yearInSeconds,
    [LockupPeriod.TwentyFourMonths]: yearInSeconds.mul(new BN(2)),
  }

  async function stake({from, amount}: {from: string; amount: BN | string}): Promise<BN> {
    await fidu.approve(stakingRewards.address, amount, {from})
    const receipt = await stakingRewards.stake(amount, {from})
    const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))

    // Verify Staked event has correct fields
    expect(stakedEvent.args.amount).to.bignumber.equal(amount)
    expect(stakedEvent.args.lockedUntil).to.bignumber.equal(new BN(0))
    expect(stakedEvent.args.multiplier).to.bignumber.equal(new BN(String(1e18)))
    expect(stakedEvent.args.user).to.equal(from)

    return stakedEvent.args.tokenId
  }

  async function stakeWithLockup({
    from,
    amount,
    lockupPeriod = LockupPeriod.SixMonths,
  }: {
    from: string
    amount: BN | string
    lockupPeriod?: LockupPeriod
  }): Promise<BN> {
    await fidu.approve(stakingRewards.address, amount, {from})
    const receipt = await stakingRewards.stakeWithLockup(amount, lockupPeriod, {from})
    const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))

    const now = await time.latest()
    const duration = lockupPeriodToDuration[lockupPeriod]
    const expectedLockedUntil = now.add(duration)

    // Verify Staked event has correct fields
    expect(stakedEvent.args.amount).to.bignumber.equal(amount)
    expect(stakedEvent.args.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    expect(stakedEvent.args.multiplier).to.bignumber.equal(await stakingRewards.getLeverageMultiplier(lockupPeriod))
    expect(stakedEvent.args.user).to.equal(from)

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
    const [_owner, _investor, _anotherUser] = await web3.eth.getAccounts()
    const owner = asNonNullable(_owner)
    const investor = asNonNullable(_investor)
    const anotherUser = asNonNullable(_anotherUser)
    const {goldfinchConfig, seniorPool, gfi, stakingRewards, fidu, usdc} = await deployAllContracts(deployments)
    await goldfinchConfig.bulkAddToGoList([owner, investor, anotherUser])
    await erc20Approve(usdc, investor, usdcVal(10000), [owner])
    await erc20Transfer(usdc, [investor], usdcVal(10000), owner)

    await erc20Approve(usdc, anotherUser, usdcVal(50000), [owner])
    await erc20Transfer(usdc, [anotherUser], usdcVal(50000), owner)

    await erc20Approve(usdc, seniorPool.address, usdcVal(50000), [anotherUser])
    let receipt = await seniorPool.deposit(usdcVal(50000), {from: anotherUser})
    let depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
    const anotherUserFiduAmount = depositEvent.args.shares

    await erc20Approve(usdc, seniorPool.address, usdcVal(5000), [investor])
    receipt = await seniorPool.deposit(usdcVal(5000), {from: investor})
    depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
    const fiduAmount = new BN(depositEvent.args.shares)

    const targetCapacity = bigVal(1000)
    const maxRate = bigVal(1000)
    const minRate = bigVal(100)
    const maxRateAtPercent = new BN(5).mul(new BN(String(1e17))) // 50%
    const minRateAtPercent = new BN(3).mul(new BN(String(1e18))) // 300%

    await stakingRewards.setTargetCapacity(targetCapacity)
    await stakingRewards.setMaxRate(maxRate)
    await stakingRewards.setMinRate(minRate)
    await stakingRewards.setMinRateAtPercent(minRateAtPercent)
    await stakingRewards.setMaxRateAtPercent(maxRateAtPercent)

    return {
      owner,
      investor,
      anotherUser,
      goldfinchConfig,
      seniorPool,
      gfi,
      stakingRewards,
      fidu,
      usdc,
      targetCapacity,
      maxRate,
      minRate,
      maxRateAtPercent,
      minRateAtPercent,
      fiduAmount,
      anotherUserFiduAmount,
    }
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      investor,
      anotherUser,
      goldfinchConfig,
      seniorPool,
      gfi,
      stakingRewards,
      fidu,
      usdc,
      targetCapacity,
      maxRate,
      minRate,
      maxRateAtPercent,
      minRateAtPercent,
      fiduAmount,
      anotherUserFiduAmount,
    } = await testSetup())
  })

  describe("stake", () => {
    let totalRewards: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      totalRewards = maxRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Fix the reward rate to make testing easier
      await stakingRewards.setMinRate(maxRate)

      // Disable vesting, to make testing base staking functionality easier
      await stakingRewards.setVestingSchedule(new BN(0))
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

    context("paused", async () => {
      it("reverts", async () => {
        await stakingRewards.pause()
        await expect(stake({amount: fiduAmount, from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("depositAndStake", async () => {
    it("deposits into senior pool and stakes resulting shares", async () => {
      const amount = usdcVal(1000)
      const balanceBefore = await usdc.balanceOf(investor)
      const seniorPoolAssetsBefore = await seniorPool.assets()

      await usdc.approve(stakingRewards.address, amount, {from: investor})
      const receipt = await stakingRewards.depositAndStake(amount, {from: investor})
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const tokenId = stakedEvent.args.tokenId

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
  })

  describe("depositWithPermitAndStake", async () => {
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

      const receipt = await stakingRewards.depositWithPermitAndStake(amount, deadline, v, r as any, s as any, {
        from: investor,
      })
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const tokenId = stakedEvent.args.tokenId

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
  })

  describe("depositAndStakeWithLockup", async () => {
    it("deposits into senior pool and stakes resulting shares with lockup", async () => {
      const amount = usdcVal(1000)
      const balanceBefore = await usdc.balanceOf(investor)
      const seniorPoolAssetsBefore = await seniorPool.assets()

      await usdc.approve(stakingRewards.address, amount, {from: investor})
      const receipt = await stakingRewards.depositAndStakeWithLockup(amount, LockupPeriod.SixMonths, {from: investor})
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const tokenId = stakedEvent.args.tokenId

      // Verify deposit worked
      expect(await usdc.balanceOf(investor)).to.bignumber.equal(balanceBefore.sub(amount))
      expect(await seniorPool.assets()).to.bignumber.equal(seniorPoolAssetsBefore.add(amount))

      // Verify shares were staked
      expect(await stakingRewards.ownerOf(tokenId)).to.equal(investor)
      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(bigVal(1000))

      // Verify that allowance was correctly used
      expect(await usdc.allowance(stakingRewards.address, seniorPool.address)).to.bignumber.equal(new BN(0))

      // Verify that shares are locked up
      await expect(stakingRewards.unstake(tokenId, bigVal(1000), {from: investor})).to.be.rejectedWith(/locked/)
      advanceTime({seconds: halfYearInSeconds})
      await expect(stakingRewards.unstake(tokenId, bigVal(1000), {from: investor})).to.be.fulfilled
    })

    context("paused", async () => {
      it("reverts", async () => {
        await stakingRewards.pause()
        await expect(
          stakingRewards.depositAndStakeWithLockup(usdcVal(1000), LockupPeriod.SixMonths, {from: investor})
        ).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("depositWithPermitAndStakeWithLockup", async () => {
    it("deposits into senior pool and stakes resulting shares with lockup", async () => {
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

      await usdc.approve(stakingRewards.address, amount, {from: investor})
      const receipt = await stakingRewards.depositWithPermitAndStakeWithLockup(
        amount,
        LockupPeriod.SixMonths,
        deadline,
        v,
        r as any,
        s as any,
        {from: investor}
      )
      const stakedEvent = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
      const tokenId = stakedEvent.args.tokenId

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

      // Verify that shares are locked up
      await expect(stakingRewards.unstake(tokenId, bigVal(1000), {from: investor})).to.be.rejectedWith(/locked/)
      advanceTime({seconds: halfYearInSeconds})
      await expect(stakingRewards.unstake(tokenId, bigVal(1000), {from: investor})).to.be.fulfilled
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

        const balanceBefore = await usdc.balanceOf(investor)
        const seniorPoolAssetsBefore = await seniorPool.assets()

        await stakingRewards.pause()
        await expect(
          stakingRewards.depositWithPermitAndStakeWithLockup(
            amount,
            LockupPeriod.SixMonths,
            deadline,
            v,
            r as any,
            s as any,
            {from: investor}
          )
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
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Disable vesting
      await stakingRewards.setVestingSchedule(new BN(0))
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

    context("position is locked-up", async () => {
      it("reverts", async () => {
        const tokenId = await stakeWithLockup({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: investor})).to.be.rejectedWith(
          /staked funds are locked/
        )
      })
    })

    context("position is vesting", async () => {
      beforeEach(async function () {
        // Enable vesting
        await stakingRewards.setVestingSchedule(yearInSeconds)
      })

      it("slashes unvested rewards by the percent withdrawn", async () => {
        await stake({amount: bigVal(100), from: anotherUser})
        const tokenId = await stake({amount: bigVal(100), from: investor})

        await advanceTime({seconds: halfYearInSeconds})

        // Unstake 90% of position
        await stakingRewards.unstake(tokenId, bigVal(90), {from: investor})

        // 50% vested with 1/2 pool ownership, should be able to claim a quarter of rewards disbursed
        const grantedRewardsInFirstHalf = rewardRate.mul(halfYearInSeconds).div(new BN(2))
        const vestedRewardsInFirstHalf = grantedRewardsInFirstHalf.div(new BN(2))
        await expectAction(() => stakingRewards.getReward(tokenId, {from: investor})).toChange([
          [() => gfi.balanceOf(investor), {byCloseTo: vestedRewardsInFirstHalf}],
        ])

        await advanceTime({seconds: halfYearInSeconds})

        // 10% of unvested rewards from the first half year should still be claimable
        // In addition, rewards accrued from the remaining 100 staked tokens for the second half year should be claimable
        const unvestedFromFirstHalf = grantedRewardsInFirstHalf.sub(vestedRewardsInFirstHalf).div(new BN(10))
        const newRewards = rewardRate.mul(halfYearInSeconds).div(new BN(11))
        const expectedRewardsInSecondHalf = unvestedFromFirstHalf.add(newRewards)
        await expectAction(() => stakingRewards.getReward(tokenId, {from: investor})).toChange([
          [() => gfi.balanceOf(investor), {byCloseTo: expectedRewardsInSecondHalf}],
        ])
      })
    })

    context("user does not own position token", async () => {
      it("reverts", async () => {
        const tokenId = await stakeWithLockup({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: anotherUser})).to.be.rejectedWith(
          /access denied/
        )
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

  describe("unstakeAndWithdrawInFidu", async () => {
    let totalRewards: BN
    let rewardRate: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      rewardRate = bigVal(100)

      // Fix the reward rate
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Disable vesting
      await stakingRewards.setVestingSchedule(new BN(0))
    })

    it("unstakes fidu and withdraws from the senior pool", async () => {
      await stake({amount: fiduAmount.mul(new BN(4)), from: anotherUser})

      const tokenId = await stake({amount: fiduAmount, from: investor})

      const withdrawAmount = fiduAmount.div(new BN(2))
      const withdrawAmountInUsdc = await quoteFiduToUSDC({seniorPool, fiduAmount: withdrawAmount})

      await expectAction(async () => {
        const receipt = await stakingRewards.unstakeAndWithdrawInFidu(tokenId, withdrawAmount, {from: investor})
        expectEvent(receipt, "Unstaked", {user: investor, tokenId, amount: withdrawAmount})
      }).toChange([
        [() => usdc.balanceOf(investor), {by: withWithdrawalFee(withdrawAmountInUsdc)}],
        [() => seniorPool.assets(), {by: withdrawAmountInUsdc.neg()}],
        [() => stakingRewards.totalStakedSupply(), {by: withdrawAmount.neg()}],
      ])
      await expectAction(() =>
        stakingRewards.unstakeAndWithdrawInFidu(tokenId, withdrawAmount, {from: investor})
      ).toChange([
        [() => usdc.balanceOf(investor), {by: withWithdrawalFee(withdrawAmountInUsdc)}],
        [() => seniorPool.assets(), {by: withdrawAmountInUsdc.neg()}],
        [() => stakingRewards.totalStakedSupply(), {by: withdrawAmount.neg()}],
      ])
      await expect(stakingRewards.unstakeAndWithdrawInFidu(tokenId, withdrawAmount, {from: investor})).to.be.rejected
    })

    context("user does not own position token", async () => {
      it("reverts", async () => {
        const tokenId = await stakeWithLockup({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await expect(
          stakingRewards.unstakeAndWithdrawInFidu(tokenId, fiduAmount, {from: anotherUser})
        ).to.be.rejectedWith(/access denied/)
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: bigVal(100), from: investor})
        await stakingRewards.pause()
        await expect(
          stakingRewards.unstakeAndWithdrawInFidu(tokenId, bigVal(100), {from: investor})
        ).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("unstakeAndWithdraw", async () => {
    let totalRewards: BN
    let rewardRate: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      rewardRate = bigVal(100)

      // Fix the reward rate
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Disable vesting
      await stakingRewards.setVestingSchedule(new BN(0))
    })

    it("unstakes fidu and withdraws from the senior pool", async () => {
      await stake({amount: fiduAmount.mul(new BN(4)), from: anotherUser})

      const tokenId = await stake({amount: fiduAmount, from: investor})

      const withdrawAmount = fiduAmount.div(new BN(2))
      const withdrawAmountInUsdc = await quoteFiduToUSDC({seniorPool, fiduAmount: withdrawAmount})

      await expectAction(async () => {
        const receipt = await stakingRewards.unstakeAndWithdraw(tokenId, withdrawAmountInUsdc, {from: investor})
        expectEvent(receipt, "Unstaked", {user: investor, tokenId, amount: withdrawAmount})
      }).toChange([
        [() => usdc.balanceOf(investor), {by: withWithdrawalFee(withdrawAmountInUsdc)}],
        [() => seniorPool.assets(), {by: withdrawAmountInUsdc.neg()}],
        [() => stakingRewards.totalStakedSupply(), {by: withdrawAmount.neg()}],
      ])
      await expectAction(() =>
        stakingRewards.unstakeAndWithdraw(tokenId, withdrawAmountInUsdc, {from: investor})
      ).toChange([
        [() => usdc.balanceOf(investor), {by: withWithdrawalFee(withdrawAmountInUsdc)}],
        [() => seniorPool.assets(), {by: withdrawAmountInUsdc.neg()}],
        [() => stakingRewards.totalStakedSupply(), {by: withdrawAmount.neg()}],
      ])
      await expect(stakingRewards.unstakeAndWithdraw(tokenId, withdrawAmountInUsdc, {from: investor})).to.be.rejected
    })

    context("user does not own position token", async () => {
      it("reverts", async () => {
        const tokenId = await stakeWithLockup({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await expect(stakingRewards.unstakeAndWithdraw(tokenId, usdcVal(100), {from: anotherUser})).to.be.rejectedWith(
          /access denied/
        )
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: bigVal(100), from: investor})
        await stakingRewards.pause()
        await expect(stakingRewards.unstakeAndWithdraw(tokenId, usdcVal(100), {from: investor})).to.be.rejectedWith(
          /paused/
        )
      })
    })
  })

  describe("unstakeAndWithdrawMultiple", async () => {
    let totalRewards: BN
    let rewardRate: BN
    let firstToken: BN, secondToken: BN, thirdTokenFromDifferentUser: BN
    let firstTokenAmount: BN, secondTokenAmount: BN, thirdTokenAmount: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      rewardRate = bigVal(100)

      // Fix the reward rate
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Disable vesting
      await stakingRewards.setVestingSchedule(new BN(0))

      // Set up stakes
      firstTokenAmount = fiduAmount.mul(new BN(3)).div(new BN(4))
      firstToken = await stake({amount: firstTokenAmount, from: investor})

      secondTokenAmount = fiduAmount.mul(new BN(1)).div(new BN(4))
      secondToken = await stake({amount: secondTokenAmount, from: investor})

      thirdTokenAmount = fiduAmount.mul(new BN(4))
      thirdTokenFromDifferentUser = await stake({amount: thirdTokenAmount, from: anotherUser})
    })

    it("unstakes fidu and withdraws from the senior pool for multiple position tokens", async () => {
      const firstTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: firstTokenAmount})
      const secondTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: secondTokenAmount})
      const thirdTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: thirdTokenAmount})

      const totalWithdrawalAmountInFidu = firstTokenAmount.add(secondTokenAmount)
      const totalWithdrawalAmountInUsdc = firstTokenWithdrawAmount.add(secondTokenWithdrawAmount)
      await expectAction(() =>
        stakingRewards.unstakeAndWithdrawMultiple(
          [firstToken, secondToken],
          [firstTokenWithdrawAmount, secondTokenWithdrawAmount],
          {from: investor}
        )
      ).toChange([
        [() => usdc.balanceOf(investor), {by: withWithdrawalFee(totalWithdrawalAmountInUsdc)}],
        [() => seniorPool.assets(), {by: totalWithdrawalAmountInUsdc.neg()}],
        [() => stakingRewards.totalStakedSupply(), {by: totalWithdrawalAmountInFidu.neg()}],
      ])
      await expect(
        stakingRewards.unstakeAndWithdrawMultiple(
          [firstToken, secondToken],
          [firstTokenWithdrawAmount, secondTokenWithdrawAmount],
          {from: investor}
        )
      ).to.be.rejected
    })

    describe("validations", async () => {
      context("user does not own position token", async () => {
        it("reverts", async () => {
          const firstTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: firstTokenAmount})
          const secondTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: secondTokenAmount})
          const thirdTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: thirdTokenAmount})

          await expect(
            stakingRewards.unstakeAndWithdrawMultiple(
              [firstToken, secondToken, thirdTokenFromDifferentUser],
              [firstTokenWithdrawAmount, secondTokenWithdrawAmount, thirdTokenWithdrawAmount],
              {from: investor}
            )
          ).to.be.rejectedWith(/access denied/)
        })
      })

      context("paused", async () => {
        it("reverts", async () => {
          const firstTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: firstTokenAmount})
          const secondTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: secondTokenAmount})

          await stakingRewards.pause()
          await expect(
            stakingRewards.unstakeAndWithdrawMultiple(
              [firstToken, secondToken],
              [firstTokenWithdrawAmount, secondTokenWithdrawAmount],
              {from: investor}
            )
          ).to.be.rejectedWith(/paused/)
        })
      })

      context("any amount exceeds withdrawable amount for that token", async () => {
        it("reverts", async () => {
          const firstTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: firstTokenAmount})
          const secondTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: secondTokenAmount})

          await expect(
            stakingRewards.unstakeAndWithdrawMultiple(
              [firstToken, secondToken],
              [firstTokenWithdrawAmount, secondTokenWithdrawAmount.add(new BN(100))],
              {from: investor}
            )
          ).to.be.rejectedWith(/cannot unstake more than staked balance/)
        })
      })

      context("tokenIds and usdcAmounts lengths mismatch", async () => {
        it("reverts", async () => {
          const firstTokenWithdrawAmount = await quoteFiduToUSDC({seniorPool, fiduAmount: firstTokenAmount})

          await expect(
            stakingRewards.unstakeAndWithdrawMultiple([firstToken, secondToken], [firstTokenWithdrawAmount], {
              from: investor,
            })
          ).to.be.rejectedWith(/tokenIds and usdcAmounts must be the same length/)
        })
      })
    })
  })

  describe("unstakeAndWithdrawMultipleInFidu", async () => {
    let totalRewards: BN
    let rewardRate: BN
    let firstToken: BN, secondToken: BN, thirdTokenFromDifferentUser: BN
    let firstTokenAmount: BN, secondTokenAmount: BN, thirdTokenAmount: BN

    beforeEach(async function () {
      // Mint rewards for a full year
      rewardRate = bigVal(100)

      // Fix the reward rate
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

      totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)

      // Disable vesting
      await stakingRewards.setVestingSchedule(new BN(0))

      // Set up stakes
      firstTokenAmount = fiduAmount.mul(new BN(3)).div(new BN(4))
      firstToken = await stake({amount: firstTokenAmount, from: investor})

      secondTokenAmount = fiduAmount.mul(new BN(1)).div(new BN(4))
      secondToken = await stake({amount: secondTokenAmount, from: investor})

      thirdTokenAmount = fiduAmount.mul(new BN(4))
      thirdTokenFromDifferentUser = await stake({amount: thirdTokenAmount, from: anotherUser})
    })

    it("unstakes fidu and withdraws from the senior pool for multiple position tokens", async () => {
      const firstTokenAmountInUsdc = await quoteFiduToUSDC({seniorPool, fiduAmount: firstTokenAmount})
      const secondTokenAmountInUsd = await quoteFiduToUSDC({seniorPool, fiduAmount: secondTokenAmount})

      const totalWithdrawalAmountInFidu = firstTokenAmount.add(secondTokenAmount)
      const totalWithdrawalAmountInUsdc = firstTokenAmountInUsdc.add(secondTokenAmountInUsd)
      await expectAction(() =>
        stakingRewards.unstakeAndWithdrawMultipleInFidu(
          [firstToken, secondToken],
          [firstTokenAmount, secondTokenAmount],
          {from: investor}
        )
      ).toChange([
        [() => usdc.balanceOf(investor), {by: withWithdrawalFee(totalWithdrawalAmountInUsdc)}],
        [() => seniorPool.assets(), {by: totalWithdrawalAmountInUsdc.neg()}],
        [() => stakingRewards.totalStakedSupply(), {by: totalWithdrawalAmountInFidu.neg()}],
      ])
      await expect(
        stakingRewards.unstakeAndWithdrawMultipleInFidu(
          [firstToken, secondToken],
          [firstTokenAmount, secondTokenAmount],
          {from: investor}
        )
      ).to.be.rejected
    })

    describe("validations", async () => {
      context("user does not own position token", async () => {
        it("reverts", async () => {
          await expect(
            stakingRewards.unstakeAndWithdrawMultipleInFidu(
              [firstToken, secondToken, thirdTokenFromDifferentUser],
              [firstTokenAmount, secondTokenAmount, thirdTokenAmount],
              {from: investor}
            )
          ).to.be.rejectedWith(/access denied/)
        })
      })

      context("paused", async () => {
        it("reverts", async () => {
          await stakingRewards.pause()
          await expect(
            stakingRewards.unstakeAndWithdrawMultipleInFidu(
              [firstToken, secondToken],
              [firstTokenAmount, secondTokenAmount],
              {from: investor}
            )
          ).to.be.rejectedWith(/paused/)
        })
      })

      context("any amount exceeds withdrawable amount for that token", async () => {
        it("reverts", async () => {
          await expect(
            stakingRewards.unstakeAndWithdrawMultipleInFidu(
              [firstToken, secondToken],
              [firstTokenAmount, secondTokenAmount.add(new BN(100))],
              {from: investor}
            )
          ).to.be.rejectedWith(/cannot unstake more than staked balance/)
        })
      })

      context("tokenIds and usdcAmounts lengths mismatch", async () => {
        it("reverts", async () => {
          await expect(
            stakingRewards.unstakeAndWithdrawMultipleInFidu([firstToken, secondToken], [firstTokenAmount], {
              from: investor,
            })
          ).to.be.rejectedWith(/tokenIds and usdcAmounts must be the same length/)
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
      await stakingRewards.setMinRate(maxRate)

      // Disable vesting, to make testing base staking functionality easier
      await stakingRewards.setVestingSchedule(new BN(0))
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

        await expect(stakingRewards.getReward(tokenId, {from: anotherUser})).to.be.rejectedWith(/access denied/)
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
      await stakeWithLockup({amount: fiduAmount, from: investor})

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
      await stakingRewards.setMaxRate(rewardRate)
      await stakingRewards.setMinRate(rewardRate)

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
        await stakingRewards.setMaxRate(rewardRate)
        await stakingRewards.setMinRate(rewardRate)

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
        await stakingRewards.setMinRate(rewardRate1)
        await stakingRewards.setMaxRate(rewardRate1)

        // Mint rewards for one year
        const totalRewards = rewardRate1.mul(yearInSeconds)
        await mintRewards(totalRewards)

        await stake({amount: fiduAmount, from: anotherUser})

        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        // Lower the reward rate
        const rewardRate2 = new BN(String(1e18))
        await stakingRewards.setMinRate(rewardRate2)
        await stakingRewards.setMaxRate(rewardRate2)

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
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

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

    context("boosting", async () => {
      it("accounts for boosting", async () => {
        await stake({amount: fiduAmount, from: anotherUser})
        const tokenId = await stakeWithLockup({
          amount: fiduAmount,
          lockupPeriod: LockupPeriod.TwelveMonths,
          from: investor,
        })

        await advanceTime({seconds: halfYearInSeconds})
        await ethers.provider.send("evm_mine", [])

        // Threshold of 2 second of rewards to account for slight delay between anotherUser
        // and investor staking
        const threshold = new BN(2).mul(rewardRate)

        const expected = rewardRate.mul(halfYearInSeconds).mul(new BN(2)).div(new BN(3))
        expect(await stakingRewards.earnedSinceLastCheckpoint(tokenId)).to.bignumber.closeTo(expected, threshold)

        await advanceTime({seconds: halfYearInSeconds})
        await stakingRewards.getReward(tokenId, {from: investor})

        // It should return 0, since the last checkpoint occcured in the current block
        expect(await stakingRewards.earnedSinceLastCheckpoint(tokenId)).to.bignumber.equal(new BN(0))
      })
    })
  })

  describe("exit", async () => {
    let rewardRate: BN

    beforeEach(async function () {
      rewardRate = new BN(String(2e18))
      // Fix the reward rate to make testing easier
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

      // Mint rewards for one year
      const totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)
    })

    it("transfers staked tokens and rewards to sender", async () => {
      const tokenId = await stake({amount: fiduAmount, from: investor})

      await advanceTime({seconds: yearInSeconds})

      await stakingRewards.exit(tokenId, {from: investor})

      expect(await gfi.balanceOf(investor)).to.bignumber.equal(rewardRate.mul(yearInSeconds))
      expect(await fidu.balanceOf(investor)).to.bignumber.equal(fiduAmount)
      expect(await stakingRewards.stakedBalanceOf(tokenId)).to.bignumber.equal(new BN(0))
      await expect(stakingRewards.exit(tokenId, {from: investor})).to.be.rejectedWith(/Cannot unstake 0/)
    })

    context("user does not own position token", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: yearInSeconds})

        await expect(stakingRewards.exit(tokenId, {from: anotherUser})).to.be.rejectedWith(/access denied/)
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: bigVal(100), from: investor})
        await advanceTime({seconds: 10000})
        await stakingRewards.pause()
        await expect(stakingRewards.exit(tokenId, {from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("exitAndWithdraw", async () => {
    let rewardRate: BN

    beforeEach(async function () {
      rewardRate = new BN(String(2e18))
      // Fix the reward rate to make testing easier
      await stakingRewards.setMinRate(rewardRate)
      await stakingRewards.setMaxRate(rewardRate)

      // Mint rewards for one year
      const totalRewards = rewardRate.mul(yearInSeconds)
      await mintRewards(totalRewards)
    })

    it("exits staking and withdraws from the senior pool", async () => {
      const tokenId = await stake({amount: fiduAmount, from: investor})

      await advanceTime({seconds: yearInSeconds})

      const withdrawAmountInUsdc = await quoteFiduToUSDC({seniorPool, fiduAmount})

      await expectAction(() => stakingRewards.exitAndWithdraw(tokenId, {from: investor})).toChange([
        [() => usdc.balanceOf(investor), {by: withWithdrawalFee(withdrawAmountInUsdc)}],
        [() => seniorPool.assets(), {by: withdrawAmountInUsdc.neg()}],
        [() => stakingRewards.totalStakedSupply(), {by: fiduAmount.neg()}],
        [() => stakingRewards.stakedBalanceOf(tokenId), {by: fiduAmount.neg()}],
      ])
    })

    context("user does not own position token", async () => {
      it("reverts", async () => {
        const tokenId = await stakeWithLockup({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 10000})

        await expect(stakingRewards.exitAndWithdraw(tokenId, {from: anotherUser})).to.be.rejectedWith(/access denied/)
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        const tokenId = await stake({amount: bigVal(100), from: investor})
        await stakingRewards.pause()
        await expect(stakingRewards.exitAndWithdraw(tokenId, {from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("vesting", async () => {
    beforeEach(async function () {
      // Mint a small, fixed amount that limits reward disbursement
      // so we can test the vesting
      await mintRewards("100000")
    })

    it("vests linearly over a year", async () => {
      // Stake fidu
      const tokenId = await stake({amount: fiduAmount, from: investor})

      await advanceTime({seconds: halfYearInSeconds})

      await stakingRewards.getReward(tokenId, {from: investor})
      let gfiBalance = await gfi.balanceOf(investor)
      expect(gfiBalance).to.bignumber.equal("50000")

      await advanceTime({seconds: halfYearInSeconds})

      await stakingRewards.getReward(tokenId, {from: investor})
      gfiBalance = await gfi.balanceOf(investor)
      expect(gfiBalance).to.bignumber.equal("100000")
    })
  })

  describe("boosting", async () => {
    let totalRewards: BN
    const rewardRate = new BN(String(1e18))

    beforeEach(async function () {
      // Fix the reward rate to make testing easier
      await stakingRewards.setMaxRate(rewardRate)
      await stakingRewards.setMinRate(rewardRate)

      totalRewards = rewardRate.mul(yearInSeconds.mul(new BN(3)))
      await mintRewards(totalRewards)

      // Disable vesting, to make testing base staking functionality easier
      await stakingRewards.setVestingSchedule(new BN(0))
    })

    describe("stakeWithLockup", async () => {
      it("boosts rewards", async () => {
        await stake({amount: fiduAmount.mul(new BN(2)), from: anotherUser})

        await advanceTime({seconds: 100})

        const tokenId = await stakeWithLockup({
          amount: fiduAmount,
          lockupPeriod: LockupPeriod.TwelveMonths,
          from: investor,
        })

        await advanceTime({seconds: yearInSeconds})

        // Even though investor deposited half the tokens as anotherUser, they get a 2x
        // multiplier from lock-up, making their effective balance equal to anotherUser.
        // Therefore, they should get half of the total rewards for the 1 year duration
        // that they are in the pool
        await stakingRewards.getReward(tokenId, {from: investor})
        const gfiBalance = await gfi.balanceOf(investor)

        const expectedRewards = rewardRate.mul(yearInSeconds).div(new BN(2))
        expect(gfiBalance).to.bignumber.equal(expectedRewards)
      })

      it("uses leverage multipliers", async () => {
        await stakingRewards.setLeverageMultiplier(LockupPeriod.TwelveMonths, bigVal(4)) // 4x leverage

        await stake({amount: fiduAmount.mul(new BN(2)), from: anotherUser})

        await advanceTime({seconds: 100})

        const tokenId = await stakeWithLockup({
          amount: fiduAmount,
          lockupPeriod: LockupPeriod.TwelveMonths,
          from: investor,
        })

        await advanceTime({seconds: yearInSeconds})

        // Even though investor deposited half the tokens as anotherUser, they get a 4x
        // multiplier from lock-up, making their effective balance 2x anotherUser's.
        // Therefore, they should get 2/3 of the total rewards for the 1 year duration
        // that they are in the pool
        await stakingRewards.getReward(tokenId, {from: investor})
        const gfiBalance = await gfi.balanceOf(investor)

        const expectedRewards = rewardRate.mul(yearInSeconds).mul(new BN(2)).div(new BN(3))
        expect(gfiBalance).to.bignumber.equal(expectedRewards)
      })

      context("6 month lock-up", async () => {
        it("locks withdraws for 6 months", async () => {
          await stake({amount: fiduAmount, from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: fiduAmount,
            lockupPeriod: LockupPeriod.SixMonths,
            from: investor,
          })

          await advanceTime({seconds: halfYearInSeconds.div(new BN(2))})

          await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: investor})).to.be.rejectedWith(/locked/)

          await advanceTime({seconds: halfYearInSeconds.div(new BN(2))})

          await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: investor})).to.not.be.rejected
        })

        it("boosts with 1.5x multiplier", async () => {
          await stake({amount: fiduAmount, from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: fiduAmount,
            lockupPeriod: LockupPeriod.SixMonths,
            from: investor,
          })

          await advanceTime({seconds: yearInSeconds})

          // 1.5x multiplier for 1/2 the pool = 1.5/2.5 = 3/5 effective ownership
          await stakingRewards.getReward(tokenId, {from: investor})
          const gfiBalance = await gfi.balanceOf(investor)

          const expectedRewards = rewardRate.mul(yearInSeconds).mul(new BN(3)).div(new BN(5))
          expect(gfiBalance).to.bignumber.equal(expectedRewards)
        })
      })

      context("12 month lock-up", async () => {
        it("locks withdraws for 12 months", async () => {
          await stake({amount: fiduAmount, from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: fiduAmount,
            lockupPeriod: LockupPeriod.TwelveMonths,
            from: investor,
          })

          await advanceTime({seconds: halfYearInSeconds})

          await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: investor})).to.be.rejectedWith(/locked/)

          await advanceTime({seconds: halfYearInSeconds})

          await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: investor})).to.not.be.rejected
        })

        it("boosts with 2x multiplier", async () => {
          await stake({amount: fiduAmount, from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: fiduAmount,
            lockupPeriod: LockupPeriod.TwelveMonths,
            from: investor,
          })

          await advanceTime({seconds: yearInSeconds})

          // 2x multiplier for 1/2 the pool = 2/3 effective ownership
          await stakingRewards.getReward(tokenId, {from: investor})
          const gfiBalance = await gfi.balanceOf(investor)

          const expectedRewards = rewardRate.mul(yearInSeconds).mul(new BN(2)).div(new BN(3))
          expect(gfiBalance).to.bignumber.equal(expectedRewards)
        })
      })

      context("24 month lock-up", async () => {
        it("locks withdraws for 24 months", async () => {
          await stake({amount: fiduAmount, from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: fiduAmount,
            lockupPeriod: LockupPeriod.TwentyFourMonths,
            from: investor,
          })

          await advanceTime({seconds: yearInSeconds})

          await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: investor})).to.be.rejectedWith(/locked/)

          await advanceTime({seconds: yearInSeconds})

          await expect(stakingRewards.unstake(tokenId, fiduAmount, {from: investor})).to.not.be.rejected
        })

        it("boosts with 3x multiplier", async () => {
          await stake({amount: fiduAmount, from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: fiduAmount,
            lockupPeriod: LockupPeriod.TwentyFourMonths,
            from: investor,
          })

          await advanceTime({seconds: yearInSeconds})

          // 3x multiplier for 1/2 the pool = 3/4 effective ownership
          await stakingRewards.getReward(tokenId, {from: investor})
          const gfiBalance = await gfi.balanceOf(investor)

          const expectedRewards = rewardRate.mul(yearInSeconds).mul(new BN(3)).div(new BN(4))
          expect(gfiBalance).to.bignumber.equal(expectedRewards)
        })

        context("paused", async () => {
          it("reverts", async () => {
            await stakingRewards.pause()

            await expect(
              stakeWithLockup({
                amount: fiduAmount,
                lockupPeriod: LockupPeriod.TwentyFourMonths,
                from: investor,
              })
            ).to.be.rejectedWith(/paused/)
          })
        })
      })
    })

    describe("kick", async () => {
      context("user is past their lock-up period", async () => {
        it("resets the user's reward multiplier", async () => {
          await stake({amount: bigVal(3000), from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: bigVal(1000),
            lockupPeriod: LockupPeriod.TwelveMonths,
            from: investor,
          })

          await advanceTime({seconds: yearInSeconds})

          await stakingRewards.kick(tokenId)

          await advanceTime({seconds: yearInSeconds})

          // Investor staked 1/4 the total tokens and got 2x multiplier (effectively 2/5 of total tokens) for
          // half the period until they were kicked.
          // Therefore, they should get:
          //     (2/5 * 1/2) + (1/4 * 1/2)  =
          //     2/10 + 1/8 =
          //     8/40 + 5/40 =
          //     13/40
          // of the total rewards over one year
          await stakingRewards.getReward(tokenId, {from: investor})
          const gfiBalance = await gfi.balanceOf(investor)
          const expectedRewards = rewardRate.mul(yearInSeconds.mul(new BN(2)))
          expect(gfiBalance).to.bignumber.equal(expectedRewards.mul(new BN(13)).div(new BN(40)))
        })
      })

      context("user is not past their lock-up period", async () => {
        it("does nothing", async () => {
          await stake({amount: bigVal(3000), from: anotherUser})

          const tokenId = await stakeWithLockup({
            amount: bigVal(1000),
            lockupPeriod: LockupPeriod.TwelveMonths,
            from: investor,
          })

          // This should do nothing
          await advanceTime({seconds: 1})
          await stakingRewards.kick(tokenId)

          await advanceTime({seconds: halfYearInSeconds})

          // Threshold of 5 seconds of rewards to account for slight block.timestamp increase when kicking
          const threshold = new BN(5).mul(rewardRate)

          // investor should still account for 2/5 of the rewards due to boosting (kick did nothing)
          await stakingRewards.getReward(tokenId, {from: investor})
          const gfiBalance = await gfi.balanceOf(investor)
          const expectedRewards = rewardRate.mul(halfYearInSeconds)
          expect(gfiBalance).to.bignumber.closeTo(expectedRewards.mul(new BN(2)).div(new BN(5)), threshold)
        })
      })

      context("paused", async () => {
        it("reverts", async () => {
          const tokenId = await stakeWithLockup({
            amount: bigVal(1000),
            lockupPeriod: LockupPeriod.TwelveMonths,
            from: investor,
          })
          await stakingRewards.pause()
          await expect(stakingRewards.kick(tokenId)).to.be.rejectedWith(/paused/)
        })
      })
    })

    describe("getLeverageMultiplier", async () => {
      it("returns the leverage multiplier for a given lockup period", async () => {
        expect(await stakingRewards.getLeverageMultiplier(LockupPeriod.SixMonths)).to.bignumber.equal(
          new BN(String(15e17))
        )
        expect(await stakingRewards.getLeverageMultiplier(LockupPeriod.TwelveMonths)).to.bignumber.equal(
          new BN(String(2e18))
        )
        expect(await stakingRewards.getLeverageMultiplier(LockupPeriod.TwentyFourMonths)).to.bignumber.equal(
          new BN(String(3e18))
        )
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

    beforeEach(async function () {
      await stakingRewards.setMaxRate(maxRate)
      await stakingRewards.setMinRate(minRate)
      await stakingRewards.setMinRateAtPercent(minRateAtPercent)
      await stakingRewards.setMaxRateAtPercent(maxRateAtPercent)
      await stakingRewards.setTargetCapacity(targetCapacity)

      // Mint rewards for a full year
      totalRewards = maxRate.mul(yearInSeconds)

      await mintRewards(totalRewards)

      // Disable vesting
      await stakingRewards.setVestingSchedule(new BN(0))
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
        await stakingRewards.setMinRate(maxRate)
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
        await stakingRewards.setMinRate(maxRate)
      })

      it("reverts", async () => {
        // 0.000000000000050000 fidu
        const fiduAmount = new BN(5e4)
        const tokenId = await stake({amount: fiduAmount, from: investor})

        await advanceTime({seconds: 1000})

        await expect(stakingRewards.getReward(tokenId, {from: investor})).to.be.rejectedWith(
          /additional rewardPerToken cannot exceed rewardsSinceLastUpdate/
        )
      })
    })

    context("user transfers NFT", async () => {
      beforeEach(async function () {
        // Mint rewards for a full year
        totalRewards = maxRate.mul(yearInSeconds)
        await mintRewards(totalRewards)

        // Fix the reward rate to make testing easier
        await stakingRewards.setMinRate(maxRate)

        // Disable vesting, to make testing base staking functionality easier
        await stakingRewards.setVestingSchedule(new BN(0))
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
        await expect(stakingRewards.loadRewards(bigVal(1000), {from: anotherUser})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })

  describe("setTargetCapacity", async () => {
    it("sets target capacity", async () => {
      const newTargetCapacity = bigVal(1234)
      await stakingRewards.setTargetCapacity(newTargetCapacity)

      expect(await stakingRewards.targetCapacity()).to.bignumber.equal(newTargetCapacity)
    })

    it("emits an event", async () => {
      const newTargetCapacity = bigVal(1234)
      const tx = await stakingRewards.setTargetCapacity(newTargetCapacity, {from: owner})

      expectEvent(tx, "TargetCapacityUpdated", {
        who: owner,
        targetCapacity: newTargetCapacity,
      })
    })

    it("checkpoints rewards", async () => {
      const newTargetCapacity = bigVal(1234)
      await stakingRewards.setTargetCapacity(newTargetCapacity)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(stakingRewards.setTargetCapacity(bigVal(1000), {from: anotherUser})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })

  describe("setMaxRateAtPercent", async () => {
    it("sets maxRateAtPercent", async () => {
      // 25%
      const newMaxRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      await stakingRewards.setMaxRateAtPercent(newMaxRateAtPercent)

      expect(await stakingRewards.maxRateAtPercent()).to.bignumber.equal(newMaxRateAtPercent)
    })

    it("emits an event", async () => {
      // 25%
      const newMaxRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      const tx = await stakingRewards.setMaxRateAtPercent(newMaxRateAtPercent, {from: owner})

      expectEvent(tx, "MaxRateAtPercentUpdated", {
        who: owner,
        maxRateAtPercent: newMaxRateAtPercent,
      })
    })

    it("checkpoints rewards", async () => {
      const newMaxRateAtPercent = new BN(25).mul(new BN(String(1e16)))
      await stakingRewards.setMaxRateAtPercent(newMaxRateAtPercent)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(stakingRewards.setMaxRateAtPercent(bigVal(10), {from: anotherUser})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })

  describe("setMinRateAtPercent", async () => {
    it("sets minRateAtPercent", async () => {
      // 25%
      const newMinRateAtPercent = new BN(5).mul(new BN(String(1e18)))
      await stakingRewards.setMinRateAtPercent(newMinRateAtPercent)

      expect(await stakingRewards.minRateAtPercent()).to.bignumber.equal(newMinRateAtPercent)
    })

    it("emits an event", async () => {
      // 25%
      const newMinRateAtPercent = new BN(5).mul(new BN(String(1e18)))
      const tx = await stakingRewards.setMinRateAtPercent(newMinRateAtPercent)

      expectEvent(tx, "MinRateAtPercentUpdated", {
        who: owner,
        minRateAtPercent: newMinRateAtPercent,
      })
    })

    it("checkpoints rewards", async () => {
      const newMinRateAtPercent = new BN(5).mul(new BN(String(1e18)))
      await stakingRewards.setMinRateAtPercent(newMinRateAtPercent)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(stakingRewards.setMinRateAtPercent(bigVal(5), {from: anotherUser})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })

  describe("setMaxRate", async () => {
    it("sets maxRate", async () => {
      const newMaxRate = bigVal(2500)
      await stakingRewards.setMaxRate(newMaxRate)

      expect(await stakingRewards.maxRate()).to.bignumber.equal(newMaxRate)
    })

    it("emits an event", async () => {
      const newMaxRate = bigVal(2500)
      const tx = await stakingRewards.setMaxRate(newMaxRate, {from: owner})

      expectEvent(tx, "MaxRateUpdated", {
        who: owner,
        maxRate: newMaxRate,
      })
    })

    it("checkpoints rewards", async () => {
      const newMaxRate = bigVal(2500)
      await stakingRewards.setMaxRate(newMaxRate)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(stakingRewards.setMaxRate(bigVal(5), {from: anotherUser})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })

  describe("setMinRate", async () => {
    it("sets minRate", async () => {
      const newMinRate = bigVal(2500)
      await stakingRewards.setMinRate(newMinRate)

      expect(await stakingRewards.minRate()).to.bignumber.equal(newMinRate)
    })

    it("emits an event", async () => {
      const newMinRate = bigVal(2500)
      const tx = await stakingRewards.setMinRate(newMinRate, {from: owner})

      expectEvent(tx, "MinRateUpdated", {
        who: owner,
        minRate: newMinRate,
      })
    })

    it("checkpoints rewards", async () => {
      const newMinRate = bigVal(2500)
      await stakingRewards.setMinRate(newMinRate)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(stakingRewards.setMinRate(bigVal(5), {from: anotherUser})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })

  describe("setLeverageMultiplier", async () => {
    it("sets the leverage multiplier for a given lockup period", async () => {
      await stakingRewards.setLeverageMultiplier(LockupPeriod.SixMonths, bigVal(10))
      expect(await stakingRewards.getLeverageMultiplier(LockupPeriod.SixMonths)).to.bignumber.equal(bigVal(10))
    })

    it("emits an event", async () => {
      const newLockupPeriod = LockupPeriod.SixMonths
      const newLeverageMultiplier = bigVal(10)
      const tx = await stakingRewards.setLeverageMultiplier(LockupPeriod.SixMonths, newLeverageMultiplier)

      expectEvent(tx, "LeverageMultiplierUpdated", {
        who: owner,
        lockupPeriod: new BN(newLockupPeriod),
        leverageMultiplier: newLeverageMultiplier,
      })
    })

    it("checkpoints rewards", async () => {
      await stakingRewards.setLeverageMultiplier(LockupPeriod.SixMonths, bigVal(10))

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        await expect(
          stakingRewards.setLeverageMultiplier(LockupPeriod.SixMonths, bigVal(10), {from: anotherUser})
        ).to.be.rejectedWith(/Must have admin role/)
      })
    })
  })

  describe("setVestingSchedule", async () => {
    it("sets vesting parameters", async () => {
      const vestingLength = halfYearInSeconds
      await stakingRewards.setVestingSchedule(vestingLength)

      expect(await stakingRewards.vestingLength()).to.bignumber.equal(vestingLength)
    })

    it("emits an event", async () => {
      const newVestingLength = halfYearInSeconds
      const tx = await stakingRewards.setVestingSchedule(newVestingLength, {from: owner})

      expectEvent(tx, "VestingScheduleUpdated", {
        who: owner,
        vestingLength: newVestingLength,
      })
    })

    it("checkpoints rewards", async () => {
      const vestingLength = halfYearInSeconds
      await stakingRewards.setVestingSchedule(vestingLength)

      const t = await time.latest()
      expect(await stakingRewards.lastUpdateTime()).to.bignumber.equal(t)
    })

    context("user is not admin", async () => {
      it("reverts", async () => {
        const vestingLength = halfYearInSeconds
        await expect(stakingRewards.setVestingSchedule(vestingLength, {from: anotherUser})).to.be.rejectedWith(
          /Must have admin role/
        )
      })
    })
  })
})

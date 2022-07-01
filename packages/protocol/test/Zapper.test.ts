import BN from "bn.js"
import {asNonNullable} from "@goldfinch-eng/utils"
import hre from "hardhat"
import {FIDU_DECIMALS, interestAprAsBN, TRANCHES} from "../blockchain_scripts/deployHelpers"
import {
  ERC20Instance,
  FiduInstance,
  GoldfinchConfigInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  TestFiduUSDCCurveLPInstance,
  TestStakingRewardsInstance,
  TestUniqueIdentityInstance,
  TranchedPoolInstance,
  ZapperInstance,
} from "../typechain/truffle"
import {
  advanceTime,
  bigVal,
  createPoolWithCreditLine,
  decodeAndGetFirstLog,
  decodeLogs,
  erc20Approve,
  erc20Transfer,
  fiduToUSDC,
  getCurrentTimestamp,
  getFirstLog,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR,
  usdcVal,
} from "./testHelpers"
import {deployBaseFixture, deployUninitializedTranchedPoolFixture} from "./util/fixtures"
import {DepositMade} from "../typechain/truffle/SeniorPool"
import {DepositMade as TranchedPoolDepositMade} from "../typechain/truffle/TranchedPool"
import {DepositedToCurveAndStaked, Staked} from "../typechain/truffle/StakingRewards"
import {mint as mintUID} from "./uniqueIdentityHelpers"
import {CONFIG_KEYS} from "../blockchain_scripts/configKeys"
import {time} from "@openzeppelin/test-helpers"

// Typechain doesn't generate types for solidity enums, so redefining here
enum StakedPositionType {
  Fidu,
  CurveLP,
}

const {deployments} = hre

const MULTIPLIER_DECIMALS = new BN(String(1e18))

const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const [_owner, _investor, _borrower] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const investor = asNonNullable(_investor)
  const borrower = asNonNullable(_borrower)

  const {
    goldfinchConfig,
    go,
    goldfinchFactory,
    seniorPool,
    gfi,
    stakingRewards,
    fidu,
    fiduUSDCCurveLP,
    usdc,
    zapper,
    ...others
  } = await deployBaseFixture()

  // Set up contracts
  await stakingRewards.initZapperRole()
  await seniorPool.initZapperRole()
  await go.initZapperRole()
  await stakingRewards.grantRole(await stakingRewards.ZAPPER_ROLE(), zapper.address)
  await seniorPool.grantRole(await seniorPool.ZAPPER_ROLE(), zapper.address)
  await go.grantRole(await go.ZAPPER_ROLE(), zapper.address)

  // Set up test user balances
  await goldfinchConfig.bulkAddToGoList([owner, investor, borrower])
  await erc20Approve(usdc, investor, usdcVal(10000), [owner])
  await erc20Transfer(usdc, [investor], usdcVal(10000), owner)

  // Deposit from owner
  await erc20Approve(usdc, seniorPool.address, usdcVal(1000), [owner])
  await seniorPool.deposit(usdcVal(1000), {from: owner})

  // Deposit from investor
  await erc20Approve(usdc, seniorPool.address, usdcVal(5000), [investor])
  const receipt = await seniorPool.deposit(usdcVal(5000), {from: investor})
  const depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
  const fiduAmount = new BN(depositEvent.args.shares)

  // Set up StakingRewards
  const targetCapacity = bigVal(1000)
  const maxRate = bigVal(1)
  const minRate = bigVal(1)
  const maxRateAtPercent = new BN(5).mul(new BN(String(1e17))) // 50%
  const minRateAtPercent = new BN(3).mul(new BN(String(1e18))) // 300%

  const totalRewards = maxRate.mul(SECONDS_PER_YEAR)
  const totalSupply = await gfi.totalSupply()
  await gfi.setCap(totalSupply.add(new BN(totalRewards)))
  await gfi.mint(owner, totalRewards)
  await gfi.approve(stakingRewards.address, totalRewards)
  await stakingRewards.loadRewards(totalRewards)

  await stakingRewards.setRewardsParameters(targetCapacity, minRate, maxRate, minRateAtPercent, maxRateAtPercent)
  await stakingRewards.setVestingSchedule(SECONDS_PER_YEAR)

  // Set up a TranchedPool
  const limit = usdcVal(1_000_000)
  const interestApr = interestAprAsBN("5.00")
  const paymentPeriodInDays = new BN(30)
  const termInDays = new BN(365)
  const lateFeeApr = new BN(0)
  const juniorFeePercent = new BN(20)
  const {tranchedPool} = await createPoolWithCreditLine({
    people: {owner, borrower},
    goldfinchFactory,
    juniorFeePercent,
    limit,
    interestApr,
    paymentPeriodInDays,
    termInDays,
    lateFeeApr,
    usdc,
  })

  return {
    ...others,
    fidu,
    usdc,
    owner,
    borrower,
    investor,
    fiduAmount,
    zapper,
    goldfinchConfig,
    seniorPool,
    stakingRewards,
    tranchedPool,
    fiduUSDCCurveLP,
    maxRate,
  }
})

describe("Zapper", async () => {
  let zapper: ZapperInstance
  let goldfinchConfig: GoldfinchConfigInstance
  let seniorPool: SeniorPoolInstance
  let stakingRewards: TestStakingRewardsInstance
  let tranchedPool: TranchedPoolInstance
  let fidu: FiduInstance
  let usdc: ERC20Instance
  let fiduUSDCCurveLP: TestFiduUSDCCurveLPInstance
  let poolTokens: PoolTokensInstance
  let uid: TestUniqueIdentityInstance

  let owner: string
  let investor: string
  let borrower: string

  let fiduAmount: BN

  let stakingRewardsMaxRate: BN

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      investor,
      borrower,
      fiduAmount,
      poolTokens,
      goldfinchConfig,
      tranchedPool,
      seniorPool,
      zapper,
      stakingRewards,
      fidu,
      usdc,
      fiduUSDCCurveLP,
      uniqueIdentity: uid,
      maxRate: stakingRewardsMaxRate,
    } = await testSetup())
  })

  describe("zapStakeToTranchedPool", async () => {
    it("works", async () => {
      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

      const usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
      const usdcToZap = usdcEquivalent.div(new BN(2))
      const usdcToZapInFidu = await seniorPool.getNumShares(usdcToZap)

      const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
      const stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
        .tokenId

      await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

      await stakingRewards.kick(stakedTokenId)
      const stakedPositionBefore = (await stakingRewards.positions(stakedTokenId)) as any
      const seniorPoolBalanceBefore = await seniorPool.assets()

      await stakingRewards.approve(zapper.address, stakedTokenId, {from: investor})

      const result = await zapper.zapStakeToTranchedPool(
        stakedTokenId,
        tranchedPool.address,
        TRANCHES.Junior,
        usdcToZap,
        {
          from: investor,
        }
      )

      const stakedPositionAfter = (await stakingRewards.positions(stakedTokenId)) as any
      const seniorPoolBalanceAfter = await seniorPool.assets()

      const depositEvent = await decodeAndGetFirstLog<TranchedPoolDepositMade>(
        result.receipt.rawLogs,
        tranchedPool,
        "DepositMade"
      )
      const poolTokenId = depositEvent.args.tokenId
      const tokenInfo = (await poolTokens.tokens(poolTokenId)) as any

      // it maintains investor as owner of staked position
      expect(await stakingRewards.ownerOf(stakedTokenId)).to.eq(investor)

      // it unstakes usdcToZap from StakingRewards
      expect(stakedPositionBefore.amount.sub(stakedPositionAfter.amount)).to.bignumber.eq(usdcToZapInFidu)

      // it withdraws usdcToZap from SeniorPool
      expect(seniorPoolBalanceBefore.sub(seniorPoolBalanceAfter)).to.bignumber.eq(usdcToZap)

      // it does not slash unvested rewards
      expect(stakedPositionBefore.rewards.totalUnvested).to.bignumber.closeTo(
        stakedPositionAfter.rewards.totalUnvested,
        bigVal(1)
      )

      // it deposits usdcToZap into the TranchedPool and holds the PoolToken on behalf of the user
      expect(tokenInfo.principalAmount).to.bignumber.eq(usdcToZap)
      expect(await poolTokens.ownerOf(poolTokenId)).to.eq(zapper.address)
      const zap = (await zapper.tranchedPoolZaps(poolTokenId)) as any
      expect(zap.owner).to.eq(investor)
      expect(zap.stakingPositionId).to.bignumber.eq(stakedTokenId)
    })

    describe("pool is invalid", async () => {
      it("reverts", async () => {
        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

        const usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
        const usdcToZap = usdcEquivalent.div(new BN(2))

        const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
        const stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        // Wasn't created through our factory
        const {tranchedPool: fakePool} = await deployUninitializedTranchedPoolFixture()
        await fakePool.initialize(
          goldfinchConfig.address,
          investor,
          new BN(20),
          usdcVal(1000),
          new BN(15000),
          new BN(30),
          new BN(360),
          new BN(350),
          new BN(180),
          new BN(0),
          []
        )

        await expect(
          zapper.zapStakeToTranchedPool(stakedTokenId, fakePool.address, TRANCHES.Junior, usdcToZap, {
            from: investor,
          })
        ).to.be.rejectedWith(/Invalid pool/)
      })
    })

    describe("investor does not own position token", async () => {
      it("reverts", async () => {
        // Stake from owner account
        const fiduAmount = bigVal(100)
        await fidu.approve(stakingRewards.address, fiduAmount, {from: owner})

        const usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
        const usdcToZap = usdcEquivalent.div(new BN(2))

        const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: owner})
        const ownerStakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
          .args.tokenId

        // Attempt to zap owner staked position as investor
        await expect(
          zapper.zapStakeToTranchedPool(ownerStakedTokenId, tranchedPool.address, TRANCHES.Junior, usdcToZap, {
            from: investor,
          })
        ).to.be.rejectedWith(/Not token owner/)
      })
    })

    describe("investor does not have required UID for tranched pool", async () => {
      it("reverts", async () => {
        // Mint UID with type 1
        await goldfinchConfig.removeFromGoList(investor)
        await uid.setSupportedUIDTypes([1, 2, 3], [true, true, true])
        const uidTokenType = new BN(1)
        const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
        await mintUID(hre, uid, uidTokenType, expiresAt, new BN(0), owner, undefined, investor)

        // Require UID with type 2
        await tranchedPool.setAllowedUIDTypes([2], {from: owner})

        // Stake as investor
        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

        const usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
        const usdcToZap = usdcEquivalent.div(new BN(2))

        const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
        const stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        await stakingRewards.approve(zapper.address, stakedTokenId, {from: investor})

        // Attempt to zap with UID with wrong type
        await expect(
          zapper.zapStakeToTranchedPool(stakedTokenId, tranchedPool.address, TRANCHES.Junior, usdcToZap, {
            from: investor,
          })
        ).to.be.rejectedWith(/Address not go-listed/)

        // Sanity check that it works with the correct UID type
        await tranchedPool.setAllowedUIDTypes([1], {from: owner})
        await expect(
          zapper.zapStakeToTranchedPool(stakedTokenId, tranchedPool.address, TRANCHES.Junior, usdcToZap, {
            from: investor,
          })
        ).to.be.fulfilled
      })
    })

    describe("paused", async () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

        const usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
        const usdcToZap = usdcEquivalent.div(new BN(2))

        const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
        const stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        await expect(
          zapper.zapStakeToTranchedPool(stakedTokenId, tranchedPool.address, TRANCHES.Junior, usdcToZap, {
            from: investor,
          })
        ).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("claimTranchedPoolZap", async () => {
    let usdcEquivalent: BN
    let usdcToZap: BN
    let stakedTokenId: BN
    let poolTokenId: BN

    beforeEach(async () => {
      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

      usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
      usdcToZap = usdcEquivalent.div(new BN(2))

      const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
      stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args.tokenId

      await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

      await stakingRewards.kick(stakedTokenId)

      await stakingRewards.approve(zapper.address, stakedTokenId, {from: investor})

      const result = await zapper.zapStakeToTranchedPool(
        stakedTokenId,
        tranchedPool.address,
        TRANCHES.Junior,
        usdcToZap,
        {
          from: investor,
        }
      )

      const depositEvent = await decodeAndGetFirstLog<TranchedPoolDepositMade>(
        result.receipt.rawLogs,
        tranchedPool,
        "DepositMade"
      )
      poolTokenId = depositEvent.args.tokenId
    })

    describe("TranchedPool is past lock period", async () => {
      it("allows claiming the underlying PoolToken", async () => {
        const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
        await tranchedPool.lockJuniorCapital()
        await tranchedPool.drawdown(usdcToZap, {from: borrower})
        await advanceTime({seconds: drawdownTimePeriod.add(new BN(1))})

        await zapper.claimTranchedPoolZap(poolTokenId, {from: investor})
        expect(await poolTokens.ownerOf(poolTokenId)).to.eq(investor)
      })
    })

    describe("TranchedPool is not past lock period", async () => {
      it("reverts", async () => {
        await expect(zapper.claimTranchedPoolZap(poolTokenId, {from: investor})).to.be.rejectedWith(/Zap locked/)

        const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
        await tranchedPool.lockJuniorCapital()
        await tranchedPool.drawdown(usdcToZap, {from: borrower})
        await advanceTime({seconds: drawdownTimePeriod.div(new BN(2))})

        await expect(zapper.claimTranchedPoolZap(poolTokenId, {from: investor})).to.be.rejectedWith(/Zap locked/)
      })
    })

    describe("sender does not own zap", async () => {
      it("reverts", async () => {
        const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
        await tranchedPool.lockJuniorCapital()
        await tranchedPool.drawdown(usdcToZap, {from: borrower})
        await advanceTime({seconds: drawdownTimePeriod.add(new BN(1))})

        // Claim as `borrower` instead of `investor`
        await expect(zapper.claimTranchedPoolZap(poolTokenId, {from: borrower})).to.be.rejectedWith(/Not zap owner/)
      })
    })

    describe("paused", async () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})

        await expect(zapper.claimTranchedPoolZap(poolTokenId, {from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("unzapToStakingRewards", async () => {
    let usdcEquivalent: BN
    let usdcToZap: BN
    let usdcToZapInFidu: BN
    let stakedTokenId: BN
    let poolTokenId: BN
    let zapStartedAt: BN

    beforeEach(async () => {
      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

      usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
      usdcToZap = usdcEquivalent.div(new BN(2))
      usdcToZapInFidu = await seniorPool.getNumShares(usdcToZap)

      const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
      stakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args.tokenId

      await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

      await stakingRewards.kick(stakedTokenId)

      await stakingRewards.approve(zapper.address, stakedTokenId, {from: investor})

      const result = await zapper.zapStakeToTranchedPool(
        stakedTokenId,
        tranchedPool.address,
        TRANCHES.Junior,
        usdcToZap,
        {
          from: investor,
        }
      )
      zapStartedAt = await time.latest()

      const depositEvent = await decodeAndGetFirstLog<TranchedPoolDepositMade>(
        result.receipt.rawLogs,
        tranchedPool,
        "DepositMade"
      )
      poolTokenId = depositEvent.args.tokenId
    })

    describe("Tranche has never been locked", async () => {
      it("unwinds position back to StakingRewards", async () => {
        const stakedPositionBefore = (await stakingRewards.positions(stakedTokenId)) as any
        const tranchedPoolBalanceBefore = await usdc.balanceOf(tranchedPool.address)
        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
        await zapper.unzapToStakingRewards(poolTokenId, {from: investor})
        const tokenInfo = (await poolTokens.tokens(poolTokenId)) as any
        const stakedPositionAfter = (await stakingRewards.positions(stakedTokenId)) as any
        const zapEndedAt = await time.latest()
        const tranchedPoolBalanceAfter = await usdc.balanceOf(tranchedPool.address)
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()

        // Capital has been withdrawn from TranchedPool
        expect(tokenInfo.principalRedeemed).to.bignumber.eq(new BN(0))
        expect(tokenInfo.principalAmount).to.bignumber.eq(new BN(0))
        expect(tranchedPoolBalanceBefore.sub(tranchedPoolBalanceAfter)).to.bignumber.eq(usdcToZap)

        // Capital has been added back to existing staked position
        expect(totalStakedSupplyAfter.sub(totalStakedSupplyBefore)).to.bignumber.eq(usdcToZapInFidu)
        expect(stakedPositionAfter.amount.sub(stakedPositionBefore.amount)).to.bignumber.eq(usdcToZapInFidu)

        // Vesting schedule has not changed
        expect(stakedPositionAfter.rewards.startTime).to.bignumber.eq(stakedPositionBefore.rewards.startTime)
        expect(stakedPositionAfter.rewards.endTime).to.bignumber.eq(stakedPositionBefore.rewards.endTime)

        const unvestedDiff = new BN(stakedPositionAfter.rewards.totalUnvested).sub(
          new BN(stakedPositionBefore.rewards.totalUnvested)
        )
        const vestedExpectedChange = zapEndedAt.sub(zapStartedAt).mul(stakingRewardsMaxRate).add(unvestedDiff.abs())
        expect(stakedPositionAfter.rewards.totalUnvested).to.bignumber.closeTo(
          stakedPositionBefore.rewards.totalUnvested,
          bigVal(1)
        )
        expect(
          new BN(stakedPositionAfter.rewards.totalVested).sub(new BN(stakedPositionBefore.rewards.totalVested))
        ).to.bignumber.eq(vestedExpectedChange)
      })
    })

    describe("Tranche has been locked", async () => {
      it("reverts", async () => {
        const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
        await tranchedPool.lockJuniorCapital()

        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor})).to.be.rejectedWith(/Tranche locked/)
        await advanceTime({seconds: drawdownTimePeriod.add(new BN(1))})

        // Cannot be unzapped even when capital is withdrawable (can use claimTranchedPoolZap in that case)
        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor})).to.be.rejectedWith(/Tranche locked/)
      })
    })

    describe("sender does not own zap", async () => {
      it("reverts", async () => {
        // Attempt to unzap from `borrower` instead of `investor`
        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: borrower})).to.be.rejectedWith(/Not zap owner/)
      })
    })

    describe("paused", async () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})

        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("zapStakeToCurve", async () => {
    beforeEach(async function () {
      // Set the effective multiplier for the Curve to 2x
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)
      // Set the Curve LP token virtual price to $1.00
      await fiduUSDCCurveLP._set_virtual_price(new BN(1).mul(MULTIPLIER_DECIMALS))
    })

    context("for a FIDU-only migration", async () => {
      it("creates a new staked position without slashing unvested rewards", async () => {
        const fiduToMigrate = fiduAmount.div(new BN(2))

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

        let receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
        const originalTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})
        await stakingRewards.kick(originalTokenId)

        const stakedPositionBefore = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()

        await stakingRewards.approve(zapper.address, originalTokenId, {from: investor})

        receipt = await zapper.zapStakeToCurve(originalTokenId, fiduToMigrate, new BN(0), {from: investor})

        const stakedPositionAfter = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()

        const curveLPAmount = await fiduUSDCCurveLP.calc_token_amount([fiduToMigrate, new BN(0)])

        const newTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        // it maintains investor as owner of staked position
        expect(await stakingRewards.ownerOf(originalTokenId)).to.eq(investor)

        // it unstakes FIDU from StakingRewards
        expect(stakedPositionAfter.amount).to.bignumber.eq(fiduAmount.sub(fiduToMigrate))

        // it does not slash unvested rewards
        expect(stakedPositionBefore.rewards.totalUnvested).to.bignumber.closeTo(
          stakedPositionAfter.rewards.totalUnvested,
          MULTIPLIER_DECIMALS
        )

        // It updates the total staked supply.
        // The Curve multiplier is set to 2x, so check that the total staked supply is updated accordingly.
        expect(totalStakedSupplyAfter).to.bignumber.eq(totalStakedSupplyBefore.mul(new BN(3)).div(new BN(2)))

        // it deposits all FIDU into Curve on behalf of the user
        expect(await stakingRewards.ownerOf(newTokenId)).to.eq(investor)
        expect(await stakingRewards.stakedBalanceOf(newTokenId)).to.bignumber.eq(curveLPAmount)
      })
    })

    context("for a FIDU and USDC migration", async () => {
      it("creates a new staked position without slashing unvested rewards", async () => {
        // Stake FIDU
        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})
        let receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})
        const originalTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        // Migrate half of the FIDU, along with USDC
        const fiduToMigrate = fiduAmount.div(new BN(2))
        const usdcToDeposit = usdcVal(100)

        // Update rewards for position
        await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})
        await stakingRewards.kick(originalTokenId)

        const usdcAmountBefore = await usdc.balanceOf(investor)
        const stakedPositionBefore = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()

        // Zap stake to Curve with USDC
        await stakingRewards.approve(zapper.address, originalTokenId, {from: investor})
        await usdc.approve(zapper.address, usdcToDeposit, {from: investor})
        receipt = await zapper.zapStakeToCurve(originalTokenId, fiduToMigrate, usdcToDeposit, {from: investor})

        const usdcAmountAfter = await usdc.balanceOf(investor)
        const stakedPositionAfter = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()

        const curveLPAmount = await fiduUSDCCurveLP.calc_token_amount([fiduToMigrate, usdcToDeposit])

        const newTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        // It maintains investor as owner of staked position
        expect(await stakingRewards.ownerOf(originalTokenId)).to.eq(investor)

        // It unstakes FIDU from StakingRewards
        expect(stakedPositionAfter.amount).to.bignumber.eq(fiduAmount.sub(fiduToMigrate))

        // It does not slash unvested rewards
        expect(stakedPositionBefore.rewards.totalUnvested).to.bignumber.closeTo(
          stakedPositionAfter.rewards.totalUnvested,
          MULTIPLIER_DECIMALS
        )

        // It updates the total staked supply.
        // The Curve multiplier is set to 2x, so check that the total staked supply is updated accordingly.
        expect(totalStakedSupplyAfter).to.bignumber.eq(
          totalStakedSupplyBefore.sub(fiduToMigrate).add(curveLPAmount.mul(new BN(2)))
        )

        // It deposits USDC on behalf of the user
        expect(usdcAmountAfter).to.bignumber.eq(usdcAmountBefore.sub(usdcToDeposit))

        // It stakes Curve LP tokens on behalf of user
        expect(await stakingRewards.ownerOf(newTokenId)).to.eq(investor)
        expect(await stakingRewards.stakedBalanceOf(newTokenId)).to.bignumber.eq(curveLPAmount)
      })
    })

    context("investor does not own position token", async () => {
      it("reverts", async () => {
        // Stake from owner account
        const fiduAmount = bigVal(100)
        await fidu.approve(stakingRewards.address, fiduAmount, {from: owner})

        const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: owner})
        const ownerStakedTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked"))
          .args.tokenId

        // Attempt to zap owner staked position as investor
        await expect(
          zapper.zapStakeToCurve(ownerStakedTokenId, fiduAmount, new BN(0), {from: investor})
        ).to.be.rejectedWith(/Not token owner/)
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor})

        const receipt = await stakingRewards.stake(fiduAmount, StakedPositionType.Fidu, {from: investor})

        const tokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args.tokenId

        await expect(zapper.zapStakeToCurve(tokenId, fiduAmount, new BN(0), {from: investor})).to.be.rejectedWith(
          /paused/
        )
      })
    })
  })
})

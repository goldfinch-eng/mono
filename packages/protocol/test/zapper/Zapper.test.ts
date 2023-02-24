/* eslint-disable @typescript-eslint/no-non-null-assertion */

import BN from "bn.js"
import {asNonNullable} from "@goldfinch-eng/utils"
import hre from "hardhat"
import {FIDU_DECIMALS, interestAprAsBN, TRANCHES} from "../../blockchain_scripts/deployHelpers"
import {
  ERC20Instance,
  FiduInstance,
  GoldfinchConfigInstance,
  PoolTokensInstance,
  ScheduleInstance,
  SeniorPoolInstance,
  TestFiduUSDCCurveLPInstance,
  TestStakingRewardsInstance,
  TestUniqueIdentityInstance,
  TranchedPoolInstance,
  ZapperInstance,
} from "../../typechain/truffle"
import {
  advanceTime,
  bigVal,
  createPoolWithCreditLine,
  decodeAndGetFirstLog,
  decodeLogs,
  erc20Approve,
  erc20Transfer,
  fiduToUSDC,
  getFirstLog,
  SECONDS_PER_YEAR,
  usdcVal,
  USDC_DECIMALS,
} from "../testHelpers"
import {deployBaseFixture} from "../util/fixtures"
import {DepositMade} from "../../typechain/truffle/contracts/protocol/core/SeniorPool"
import {DepositMade as TranchedPoolDepositMade} from "../../typechain/truffle/contracts/protocol/core/TranchedPool"
import {Staked} from "../../typechain/truffle/contracts/rewards/StakingRewards"
import {CONFIG_KEYS} from "../../blockchain_scripts/configKeys"
import {time} from "@openzeppelin/test-helpers"
import {getSum, stake, zapMultiple} from "./zapperTestUtils"

// Typechain doesn't generate types for solidity enums, so redefining here
enum StakedPositionType {
  Fidu,
  CurveLP,
}

const {deployments} = hre

const MULTIPLIER_DECIMALS = new BN(String(1e18))

const zapFiduSetupTest = deployments.createFixture(async ({deployments}) => {
  const {
    fiduAmount,
    fidu,
    investor1,
    stakingRewards,
    seniorPool,
    zapper,
    tranchedPool,
    secondTranchedPool,
    goldfinchConfig,
    borrower,
    schedule,
  } = await baseSetupTest()
  const firstPoolFiduAmounts = [fiduAmount.div(new BN(4)), fiduAmount.div(new BN(4))]
  const secondPoolFiduAmounts = [fiduAmount.div(new BN(2))]

  await fidu.approve(stakingRewards.address, fiduAmount, {from: investor1})
  const sharePrice = await seniorPool.sharePrice()
  const firstPoolUsdcEquivalents = firstPoolFiduAmounts.map((fiduAmount) =>
    fiduToUSDC(fiduAmount.mul(sharePrice).div(FIDU_DECIMALS))
  )
  const secondPoolUsdcEquivalents = secondPoolFiduAmounts.map((fiduAmount) =>
    fiduToUSDC(fiduAmount.mul(sharePrice).div(FIDU_DECIMALS))
  )

  const firstPoolStakedTokenIds = [
    await stake(investor1, firstPoolFiduAmounts[0]!, stakingRewards, fidu),
    await stake(investor1, firstPoolFiduAmounts[1]!, stakingRewards, fidu),
  ]
  const secondPoolStakedTokenIds = [await stake(investor1, secondPoolFiduAmounts[0]!, stakingRewards, fidu)]

  await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

  await Promise.all(
    firstPoolStakedTokenIds.concat(secondPoolStakedTokenIds).map((tokenId) => stakingRewards.kick(tokenId))
  )

  // Zap the positions
  const firstPoolTokenIds = await zapMultiple(
    investor1,
    tranchedPool,
    firstPoolStakedTokenIds,
    firstPoolFiduAmounts,
    zapper,
    stakingRewards
  )
  const secondPoolTokenIds = await zapMultiple(
    investor1,
    secondTranchedPool,
    secondPoolStakedTokenIds,
    secondPoolFiduAmounts,
    zapper,
    stakingRewards
  )

  // Lock the first tranched pool
  const totalUsdcZappedToFirstPool = getSum(firstPoolUsdcEquivalents)
  const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
  await tranchedPool.lockJuniorCapital()
  await tranchedPool.drawdown(totalUsdcZappedToFirstPool, {from: borrower})

  // Lock the second tranched pool
  const totalUsdcZappedToSecondPool = getSum(secondPoolUsdcEquivalents)
  await secondTranchedPool.lockJuniorCapital()
  await secondTranchedPool.drawdown(totalUsdcZappedToSecondPool, {from: borrower})

  await advanceTime({seconds: drawdownTimePeriod.add(new BN(1))})

  return {
    firstPoolFiduAmounts,
    secondPoolFiduAmounts,
    firstPoolUsdcEquivalents,
    secondPoolUsdcEquivalents,
    firstPoolStakedTokenIds,
    secondPoolStakedTokenIds,
    firstPoolTokenIds,
    secondPoolTokenIds,
    schedule,
  }
})

const baseSetupTest = deployments.createFixture(async () => {
  const [_owner, _investor1, _borrower, _investor2] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const investor1 = asNonNullable(_investor1)
  const investor2 = asNonNullable(_investor2)

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
    schedule,
    ...others
  } = await deployBaseFixture()

  // Set up contracts
  await go.initZapperRole()
  await seniorPool.grantRole(await seniorPool.ZAPPER_ROLE(), zapper.address)
  await go.grantRole(await go.ZAPPER_ROLE(), zapper.address)

  // Set up test user balances
  await goldfinchConfig.bulkAddToGoList([owner, investor1, borrower, investor2])
  await erc20Approve(usdc, investor1, usdcVal(10000), [owner])
  await erc20Transfer(usdc, [investor1], usdcVal(10000), owner)
  await erc20Approve(usdc, investor2, usdcVal(10000), [owner])
  await erc20Transfer(usdc, [investor2], usdcVal(10000), owner)

  await erc20Approve(fiduUSDCCurveLP, investor1, bigVal(100), [owner])
  await erc20Transfer(fiduUSDCCurveLP, [investor1], bigVal(100), owner)

  await erc20Approve(fiduUSDCCurveLP, investor2, bigVal(100), [owner])
  await erc20Transfer(fiduUSDCCurveLP, [investor2], bigVal(100), owner)

  // Deposit from owner
  await erc20Approve(usdc, seniorPool.address, usdcVal(1000), [owner])
  await seniorPool.deposit(usdcVal(1000), {from: owner})

  // Deposit from investors
  await erc20Approve(usdc, seniorPool.address, usdcVal(5000), [investor1])
  let receipt = await seniorPool.deposit(usdcVal(5000), {from: investor1})
  const depositEvent = getFirstLog<DepositMade>(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))
  const fiduAmount = new BN(depositEvent.args.shares)

  await erc20Approve(usdc, seniorPool.address, usdcVal(5000), [investor2])
  receipt = await seniorPool.deposit(usdcVal(5000), {from: investor2})

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

  // Set up two tranched pools
  const limit = usdcVal(1_000_000)
  const interestApr = interestAprAsBN("5.00")
  const termInDays = new BN(365)
  const lateFeeApr = new BN(0)
  const juniorFeePercent = new BN(20)
  const tranchedPool = (
    await createPoolWithCreditLine({
      people: {owner, borrower},
      juniorFeePercent,
      limit,
      interestApr,
      termInDays,
      lateFeeApr,
      usdc,
    })
  ).tranchedPool

  const secondTranchedPool = (
    await createPoolWithCreditLine({
      people: {owner, borrower},
      juniorFeePercent,
      limit,
      interestApr,
      lateFeeApr,
      usdc,
    })
  ).tranchedPool

  return {
    ...others,
    fidu,
    usdc,
    owner,
    borrower,
    investor1,
    investor2,
    fiduAmount,
    zapper,
    goldfinchConfig,
    seniorPool,
    stakingRewards,
    tranchedPool,
    secondTranchedPool,
    fiduUSDCCurveLP,
    maxRate,
    schedule,
  }
})

describe("Zapper", async () => {
  let zapper: ZapperInstance
  let goldfinchConfig: GoldfinchConfigInstance
  let seniorPool: SeniorPoolInstance
  let stakingRewards: TestStakingRewardsInstance
  let tranchedPool: TranchedPoolInstance
  let secondTranchedPool: TranchedPoolInstance
  let fidu: FiduInstance
  let usdc: ERC20Instance
  let fiduUSDCCurveLP: TestFiduUSDCCurveLPInstance
  let poolTokens: PoolTokensInstance
  let uid: TestUniqueIdentityInstance
  let schedule: ScheduleInstance

  let owner: string
  let investor1: string
  let investor2: string
  let borrower: string

  let fiduAmount: BN

  let stakingRewardsMaxRate: BN

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      investor1,
      investor2,
      borrower,
      fiduAmount,
      poolTokens,
      goldfinchConfig,
      tranchedPool,
      secondTranchedPool,
      seniorPool,
      zapper,
      stakingRewards,
      fidu,
      usdc,
      fiduUSDCCurveLP,
      uniqueIdentity: uid,
      maxRate: stakingRewardsMaxRate,
      schedule,
    } = await baseSetupTest())
  })

  beforeEach(async () => {
    // Reset balances such that 1 FIDU underlies a single Curve LP token
    await fiduUSDCCurveLP._setBalance(0, MULTIPLIER_DECIMALS)
    await fiduUSDCCurveLP._setBalance(1, USDC_DECIMALS)
    await fiduUSDCCurveLP._setTotalSupply(MULTIPLIER_DECIMALS)
  })

  const getPoolTokenInfos = async (poolTokenIds: BN[]): Promise<any[]> => {
    return Promise.all(poolTokenIds.map((poolTokenId) => poolTokens.tokens(poolTokenId).then((res) => res as any)))
  }

  const getStakingPos = async (stakingRewardTokenIds: BN[]): Promise<any[]> => {
    return Promise.all(
      stakingRewardTokenIds.map((tokenId) => stakingRewards.positions(tokenId).then((res) => res as any))
    )
  }

  describe("zapMultipleToTranchedPool", () => {
    describe("array size mismatch", () => {
      it("reverts", async () => {
        await expect(
          zapper.zapMultipleToTranchedPool(["1"], [], tranchedPool.address, TRANCHES.Junior)
        ).to.be.rejectedWith(/Array size mismatch/)
      })
    })

    describe("StakingRewards token ids not sorted ascending", () => {
      it("reverts", async () => {
        // Setup a staked position
        const stakedTokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)
        await expect(
          zapMultiple(
            investor1,
            tranchedPool,
            [stakedTokenId, stakedTokenId],
            [fiduAmount.div(new BN(2)), new BN(1000)],
            zapper,
            stakingRewards
          )
        ).to.be.rejectedWith(/Token ids not sorted/)
      })
    })

    describe("paused", () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})
        await expect(zapMultiple(investor1, tranchedPool, [], [], zapper, stakingRewards)).to.be.rejectedWith(
          /Pausable: paused/
        )
      })
    })

    describe("at least one token not owned by sender", () => {
      it("reverts", async () => {
        // Each investor stakes
        const investor1TokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)
        const investor2TokenId = await stake(investor2, fiduAmount, stakingRewards, fidu)

        await stakingRewards.approve(zapper.address, investor1TokenId, {from: investor1})
        await stakingRewards.approve(zapper.address, investor2TokenId, {from: investor2})

        // First investor tries to stake their token and the second investor's token
        await expect(
          zapper.zapMultipleToTranchedPool(
            [investor1TokenId, investor2TokenId],
            [fiduAmount, fiduAmount],
            tranchedPool.address,
            TRANCHES.Junior,
            {from: investor1}
          )
        ).to.be.rejectedWith(/Not token owner/)
      })
    })

    describe("at least one StakingRewards position is not FIDU", () => {
      it("reverts", async () => {
        // investor stakes FIDU
        const fiduStakingToken = await stake(investor1, fiduAmount, stakingRewards, fidu)

        // investor stakes CurveLP tokens
        await fiduUSDCCurveLP.approve(stakingRewards.address, new BN(100), {from: investor1})
        const curveLPStakingToken = await stake(
          investor1,
          new BN(100),
          stakingRewards,
          fidu,
          StakedPositionType.CurveLP
        )

        await stakingRewards.approve(zapper.address, curveLPStakingToken, {from: investor1})
        await stakingRewards.approve(zapper.address, fiduStakingToken, {from: investor1})

        // investor tries to zap CurveLP to a tranched pool. Not allowed!
        await expect(
          zapper.zapMultipleToTranchedPool(
            [fiduStakingToken, curveLPStakingToken],
            [fiduAmount, new BN(100)],
            tranchedPool.address,
            TRANCHES.Junior,
            {from: investor1}
          )
        ).to.be.rejectedWith(/Bad positionType/)
      })
    })

    describe("Zapper not approved for at least one StakingRewards position", () => {
      it("reverts", async () => {
        const investor1TokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)

        // investor tries to zap their fidu before approving the zapepr on the staking rewards token
        await expect(
          zapper.zapMultipleToTranchedPool([investor1TokenId], [fiduAmount], tranchedPool.address, TRANCHES.Junior, {
            from: investor1,
          })
        ).to.be.rejectedWith("AD")
      })
    })

    describe("valid inputs", () => {
      it("zaps", async () => {
        // investor creates two staked positions
        const sharePrice = await seniorPool.sharePrice()
        const amountsToStake = [fiduAmount.div(new BN(4)), fiduAmount.div(new BN(2))]
        const fiduZapped = getSum(amountsToStake)
        const usdcZapped = fiduToUSDC(fiduZapped.mul(sharePrice).div(FIDU_DECIMALS))
        const tokenIds = [
          await stake(investor1, amountsToStake[0]!, stakingRewards, fidu),
          await stake(investor1, amountsToStake[1]!, stakingRewards, fidu),
        ]

        await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

        await Promise.all(tokenIds.map((tokenId) => stakingRewards.kick(tokenId)))
        const stakedPositionsBefore = await Promise.all(
          tokenIds.map((tokenId) => stakingRewards.positions(tokenId).then((res) => res as any))
        )
        const seniorPoolBalanceBefore = await seniorPool.assets()

        // Zap the two staked positions
        const poolTokenIds = await zapMultiple(
          investor1,
          tranchedPool,
          tokenIds,
          amountsToStake,
          zapper,
          stakingRewards
        )
        const poolTokenInfos = await getPoolTokenInfos(poolTokenIds)

        const seniorPoolBalanceAfter = await seniorPool.assets()
        const stakedPositionsAfter = await Promise.all(
          tokenIds.map((tokenId) => stakingRewards.positions(tokenId).then((res) => res as any))
        )

        // it maintains investor as owner of staked position
        for (const tokenId of tokenIds) {
          expect(await stakingRewards.ownerOf(tokenId)).to.eq(investor1)
        }

        // it withdraws usdcToZap from SeniorPool
        expect(seniorPoolBalanceBefore.sub(seniorPoolBalanceAfter)).to.bignumber.eq(usdcZapped)

        for (let i = 0; i < stakedPositionsBefore.length; ++i) {
          // fidu is moved out of the staking position
          expect(stakedPositionsBefore[i].amount.sub(stakedPositionsAfter[i].amount)).to.bignumber.eq(amountsToStake[i])
          expect(stakedPositionsAfter[i].amount).to.bignumber.eq(new BN(0))

          // it does not slash unvested rewards
          expect(stakedPositionsBefore[i].rewards.totalUnvested).to.bignumber.closeTo(
            stakedPositionsAfter[i].rewards.totalUnvested,
            bigVal(1)
          )

          // it deposits usdcToZap into the TranchedPool
          const usdcAmountZapped = fiduToUSDC(amountsToStake[i]!.mul(sharePrice).div(FIDU_DECIMALS))
          expect(poolTokenInfos[i].principalAmount).to.bignumber.eq(usdcAmountZapped)

          // it holds the PoolToken on behalf of the user
          expect(await poolTokens.ownerOf(poolTokenIds[i] || "0")).to.eq(zapper.address)
          const zap = (await zapper.tranchedPoolZaps(poolTokenIds[i] || "0")) as any
          expect(zap.owner).to.eq(investor1)
          expect(zap.stakingPositionId).to.bignumber.eq(tokenIds[i])
        }
      })
    })
  })

  describe("unzapMultipleFromTranchedPools", () => {
    let firstPoolFiduAmounts: BN[]
    let firstPoolUsdcEquivalents: BN[]
    let firstPoolStakedTokenIds: BN[]
    let firstPoolTokenIds: BN[]

    beforeEach(async () => {
      // first investor creates two staked positions
      firstPoolFiduAmounts = [fiduAmount.div(new BN(4)), fiduAmount.div(new BN(4))]
      const sharePrice = await seniorPool.sharePrice()
      firstPoolUsdcEquivalents = firstPoolFiduAmounts.map((fiduAmount) =>
        fiduToUSDC(fiduAmount.mul(sharePrice).div(FIDU_DECIMALS))
      )
      firstPoolStakedTokenIds = [
        await stake(investor1, firstPoolFiduAmounts[0]!, stakingRewards, fidu),
        await stake(investor1, firstPoolFiduAmounts[1]!, stakingRewards, fidu),
      ]
      await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

      await Promise.all(firstPoolStakedTokenIds.map((tokenId) => stakingRewards.kick(tokenId)))

      // first investor zaps their two positions to the first tranched pool
      firstPoolTokenIds = await zapMultiple(
        investor1,
        tranchedPool,
        firstPoolStakedTokenIds,
        firstPoolFiduAmounts,
        zapper,
        stakingRewards
      )
    })

    describe("paused", () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})
        await expect(zapper.unzapMultipleFromTranchedPools([])).to.be.rejectedWith(/Pausable: paused/)
      })
    })

    describe("pool token ids not sorted ascending", () => {
      it("reverts", async () => {
        // Try unzapping in descending order
        await expect(
          zapper.unzapMultipleFromTranchedPools(firstPoolTokenIds.reverse(), {
            from: investor1,
          })
        ).to.be.rejectedWith(/Token ids not sorted/)

        // Try unzapping duplicates
        await expect(
          zapper.unzapMultipleFromTranchedPools(Array(2).fill(firstPoolTokenIds[0]), {
            from: investor1,
          })
        ).to.be.rejectedWith(/Token ids not sorted/)
      })
    })

    describe("at least one token wasn't zapped by sender", () => {
      it("reverts", async () => {
        // Investor 2 attempts to unzap Investor 1's zaps.
        await expect(zapper.unzapMultipleFromTranchedPools(firstPoolTokenIds, {from: investor2})).to.be.rejectedWith(
          /Not zap owner/
        )
      })
    })

    describe("valid tokenIds", () => {
      /**
       * Assert a succesful unzap where the pool token ids might be from different tranched pools
       */
      const expectSuccessfulUnzap = async (
        poolTokenIdsByTranchedPool: BN[][],
        stakingTokenIdsByTranchedPool: BN[][],
        fiduAmountsByTranchedPool: BN[][],
        usdcEquivalentAmountsByTranchedPool: BN[][],
        tranchedPools: TranchedPoolInstance[]
      ) => {
        // Get state variables before unzap
        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()
        const poolBalancesBefore = Array<BN>(tranchedPools.length)
        const stakedPositionsBefore = Array<any>(tranchedPools.length)

        for (let i = 0; i < tranchedPools.length; ++i) {
          poolBalancesBefore[i] = await usdc.balanceOf(tranchedPools[i]!.address)
          stakedPositionsBefore[i] = await getStakingPos(stakingTokenIdsByTranchedPool[i]!)
        }

        // Unzap
        const poolTokenIds = poolTokenIdsByTranchedPool.flatMap((arr) => arr)
        await zapper.unzapMultipleFromTranchedPools(poolTokenIds, {
          from: investor1,
        })

        // Get state variables after unzap
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()
        const poolBalancesAfter = Array<BN>(tranchedPools.length)
        const stakedPositionsAfter = Array<any>(tranchedPools.length)
        const poolTokenInfosByTranchedPool = Array<Array<any>>(tranchedPools.length)

        for (let i = 0; i < tranchedPools.length; ++i) {
          poolBalancesAfter[i] = await usdc.balanceOf(tranchedPools[i]!.address)
          stakedPositionsAfter[i] = await getStakingPos(stakingTokenIdsByTranchedPool[i]!)
          poolTokenInfosByTranchedPool[i] = await getPoolTokenInfos(poolTokenIdsByTranchedPool[i]!)
        }

        // Verifications
        const totalFiduZapped = getSum(fiduAmountsByTranchedPool.flatMap((amounts) => amounts))
        expect(totalStakedSupplyAfter.sub(totalStakedSupplyBefore)).to.bignumber.equal(totalFiduZapped)

        for (let i = 0; i < tranchedPools.length; ++i) {
          for (let j = 0; j < poolTokenIdsByTranchedPool[i]!.length; ++j) {
            // Capital has been withdrawn from the tranched pool
            const usdcEquivalent = getSum(usdcEquivalentAmountsByTranchedPool[i]!)
            expect(poolBalancesBefore[i]!.sub(poolBalancesAfter[i]!)).to.bignumber.eq(usdcEquivalent)
            expect(poolTokenInfosByTranchedPool[i]![j].principalRedeemed).to.bignumber.eq(new BN(0))
            expect(poolTokenInfosByTranchedPool[i]![j].principalAmount).to.bignumber.eq(new BN(0))

            // Capital has been added back to staked positions
            expect(stakedPositionsAfter[i][j].amount.sub(stakedPositionsBefore[i][j].amount)).to.bignumber.equal(
              fiduAmountsByTranchedPool[i]![j]
            )

            // Vesting schedule
            expect(stakedPositionsAfter[i][j].rewards.totalUnvested).to.bignumber.equal(
              stakedPositionsBefore[i][j].rewards.totalUnvested
            )
            expect(stakedPositionsAfter[i][j].rewards.endTime).to.bignumber.eq(
              stakedPositionsBefore[i][j].rewards.endTime
            )
            expect(stakedPositionsAfter[i][j].rewards.startTime).to.bignumber.eq(
              stakedPositionsBefore[i][j].rewards.startTime
            )
            // Now that vesting schedules have been removed we expect no change in the amount vested
            expect(new BN(stakedPositionsAfter[i][j].rewards.totalVested)).to.bignumber.equal(
              new BN(stakedPositionsBefore[i][j].rewards.totalVested)
            )
          }
        }
      }

      it("unzaps tokens from same TranchedPool", async () => {
        await expectSuccessfulUnzap(
          [firstPoolTokenIds],
          [firstPoolStakedTokenIds],
          [firstPoolFiduAmounts],
          [firstPoolUsdcEquivalents],
          [tranchedPool]
        )
      })

      it("can unzap from different tranched pools", async () => {
        // Zap one staked position into the second tranched pool
        const secondPoolFiduAmounts = [fiduAmount.div(new BN(4))]
        const seniorPoolSharePrice = await seniorPool.sharePrice()
        const secondPoolUsdcEquivalents = secondPoolFiduAmounts.map((fiduAmount) =>
          fiduToUSDC(fiduAmount.mul(seniorPoolSharePrice).div(FIDU_DECIMALS))
        )
        const secondPoolStakedTokenIds = [await stake(investor1, secondPoolFiduAmounts[0]!, stakingRewards, fidu)]

        // Stake to second tranched pool
        const secondTranchedPoolTokenIds = await zapMultiple(
          investor1,
          secondTranchedPool,
          secondPoolStakedTokenIds,
          secondPoolFiduAmounts,
          zapper,
          stakingRewards
        )

        await expectSuccessfulUnzap(
          [firstPoolTokenIds, secondTranchedPoolTokenIds],
          [firstPoolStakedTokenIds, secondPoolStakedTokenIds],
          [firstPoolFiduAmounts, secondPoolFiduAmounts],
          [firstPoolUsdcEquivalents, secondPoolUsdcEquivalents],
          [tranchedPool, secondTranchedPool]
        )
      })
    })
  })

  describe("claimMultipleFromTranchedPools", () => {
    let firstPoolTokenIds: BN[]
    let secondPoolTokenIds: BN[]

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({firstPoolTokenIds, secondPoolTokenIds} = await zapFiduSetupTest())
    })

    describe("paused", () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})
        await expect(zapper.claimMultipleTranchedPoolZaps([])).to.be.rejectedWith(/Pausable: paused/)
      })
    })

    describe("pool token ids not sorted ascending", () => {
      it("reverts", async () => {
        // Try unzapping in descending order
        await expect(
          zapper.claimMultipleTranchedPoolZaps(firstPoolTokenIds.reverse(), {from: investor1})
        ).to.be.rejectedWith(/Token ids not sorted/)

        // Try unzapping duplicates
        await expect(
          zapper.claimMultipleTranchedPoolZaps(Array(2).fill(firstPoolTokenIds[0]), {from: investor1})
        ).to.be.rejectedWith(/Token ids not sorted/)
      })
    })

    describe("valid tokenIds", () => {
      it("claims tokens from same TranchedPool", async () => {
        await zapper.claimMultipleTranchedPoolZaps(firstPoolTokenIds, {from: investor1})
        // I should have ownership of both my pool tokens
        for (const poolTokenId of firstPoolTokenIds) {
          expect(await poolTokens.ownerOf(poolTokenId)).to.eq(investor1)
        }
      })

      it("claims tokens from different TranchedPools", async () => {
        await zapper.claimMultipleTranchedPoolZaps(firstPoolTokenIds.concat(secondPoolTokenIds), {from: investor1})
        // I should have ownership of all the pool tokens
        for (const poolTokenId of firstPoolTokenIds.concat(secondPoolTokenIds)) {
          expect(await poolTokens.ownerOf(poolTokenId)).to.eq(investor1)
        }
      })
    })
  })

  describe("unzapToStakingRewards from FIDU zap", async () => {
    let fiduToZap: BN
    let usdcEquivalent: BN
    let stakedTokenId: BN
    let poolTokenId: BN

    beforeEach(async () => {
      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor1})

      fiduToZap = fiduAmount.div(new BN(1))
      usdcEquivalent = fiduToUSDC(fiduToZap.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))

      stakedTokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)

      await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

      await stakingRewards.kick(stakedTokenId)

      await stakingRewards.approve(zapper.address, stakedTokenId, {from: investor1})

      const result = await zapper.zapFiduStakeToTranchedPool(
        stakedTokenId,
        tranchedPool.address,
        TRANCHES.Junior,
        fiduToZap,
        {
          from: investor1,
        }
      )

      const depositEvent = await decodeAndGetFirstLog<TranchedPoolDepositMade>(
        result.receipt.rawLogs,
        tranchedPool,
        "DepositMade"
      )
      poolTokenId = depositEvent.args.tokenId
    })

    describe("Tranche has never been locked", async () => {
      it("unwinds position back to StakingRewards", async () => {
        await advanceTime({days: new BN(7)})
        await stakingRewards.kick(stakedTokenId)
        const stakedPositionBefore = (await stakingRewards.positions(stakedTokenId)) as any
        const tranchedPoolBalanceBefore = await usdc.balanceOf(tranchedPool.address)
        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()

        await zapper.unzapToStakingRewards(poolTokenId, {from: investor1})

        const tokenInfo = (await poolTokens.tokens(poolTokenId)) as any
        const stakedPositionAfter = (await stakingRewards.positions(stakedTokenId)) as any
        const tranchedPoolBalanceAfter = await usdc.balanceOf(tranchedPool.address)
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()

        // Capital has been withdrawn from TranchedPool
        expect(tokenInfo.principalRedeemed).to.bignumber.eq(new BN(0))
        expect(tokenInfo.principalAmount).to.bignumber.eq(new BN(0))
        expect(tranchedPoolBalanceBefore.sub(tranchedPoolBalanceAfter)).to.bignumber.eq(usdcEquivalent)

        // Capital has been added back to existing staked position
        expect(totalStakedSupplyAfter.sub(totalStakedSupplyBefore)).to.bignumber.eq(fiduToZap)
        expect(stakedPositionAfter.amount.sub(stakedPositionBefore.amount)).to.bignumber.eq(fiduToZap)

        // Vesting schedule has not changed
        expect(stakedPositionAfter.rewards.startTime).to.bignumber.eq(stakedPositionBefore.rewards.startTime)
        expect(stakedPositionAfter.rewards.endTime).to.bignumber.eq(stakedPositionBefore.rewards.endTime)

        expect(stakedPositionAfter.rewards.totalUnvested).to.bignumber.closeTo(
          stakedPositionBefore.rewards.totalUnvested,
          bigVal(1)
        )
        // The investor zapped `fiduAmount`, which was the entire staked supply. Between zapping and unzapping there
        // was 0 staked supply, so 0 additional rewards are earned between those times
        expect(
          new BN(stakedPositionAfter.rewards.totalVested).sub(new BN(stakedPositionBefore.rewards.totalVested))
        ).to.bignumber.equal(new BN(0))
      })
    })

    describe("Tranche has been locked", async () => {
      it("reverts", async () => {
        const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
        await tranchedPool.lockJuniorCapital()

        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor1})).to.be.rejectedWith(/Tranche locked/)
        await advanceTime({seconds: drawdownTimePeriod.add(new BN(1))})

        // Cannot be unzapped even when capital is withdrawable (can use claimTranchedPoolZap in that case)
        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor1})).to.be.rejectedWith(/Tranche locked/)
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

        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor1})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("unzapToStakingRewards from USDC zap", async () => {
    let usdcEquivalent: BN
    let usdcToZap: BN
    let usdcToZapInFidu: BN
    let stakedTokenId: BN
    let poolTokenId: BN
    let zapStartedAt: BN

    beforeEach(async () => {
      await fidu.approve(stakingRewards.address, fiduAmount, {from: investor1})

      usdcEquivalent = fiduToUSDC(fiduAmount.mul(await seniorPool.sharePrice()).div(FIDU_DECIMALS))
      usdcToZap = usdcEquivalent.div(new BN(1))
      usdcToZapInFidu = await seniorPool.getNumShares(usdcToZap)

      stakedTokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)

      await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})

      await stakingRewards.kick(stakedTokenId)

      await stakingRewards.approve(zapper.address, stakedTokenId, {from: investor1})

      const result = await zapper.zapStakeToTranchedPool(
        stakedTokenId,
        tranchedPool.address,
        TRANCHES.Junior,
        usdcToZap,
        {
          from: investor1,
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

        await zapper.unzapToStakingRewards(poolTokenId, {from: investor1})
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

        expect(stakedPositionAfter.rewards.totalUnvested).to.bignumber.closeTo(
          stakedPositionBefore.rewards.totalUnvested,
          bigVal(1)
        )
        const unvestedDiff = new BN(stakedPositionAfter.rewards.totalUnvested).sub(
          new BN(stakedPositionBefore.rewards.totalUnvested)
        )
        const vestedExpectedChange = zapEndedAt.sub(zapStartedAt).mul(stakingRewardsMaxRate).add(unvestedDiff.abs())
        expect(
          new BN(stakedPositionAfter.rewards.totalVested).sub(new BN(stakedPositionBefore.rewards.totalVested))
        ).to.bignumber.closeTo(vestedExpectedChange, bigVal(1))
      })
    })

    describe("Tranche has been locked", async () => {
      it("reverts", async () => {
        const drawdownTimePeriod = await goldfinchConfig.getNumber(CONFIG_KEYS.DrawdownPeriodInSeconds)
        await tranchedPool.lockJuniorCapital()

        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor1})).to.be.rejectedWith(/Tranche locked/)
        await advanceTime({seconds: drawdownTimePeriod.add(new BN(1))})

        // Cannot be unzapped even when capital is withdrawable (can use claimTranchedPoolZap in that case)
        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor1})).to.be.rejectedWith(/Tranche locked/)
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

        await expect(zapper.unzapToStakingRewards(poolTokenId, {from: investor1})).to.be.rejectedWith(/paused/)
      })
    })
  })

  describe("zapStakeToCurve", async () => {
    beforeEach(async function () {
      // Set the effective multiplier for the Curve to 2x
      await stakingRewards.setEffectiveMultiplier(new BN(2).mul(MULTIPLIER_DECIMALS), StakedPositionType.CurveLP)
    })

    context("for a FIDU-only migration", async () => {
      it("creates a new staked position without slashing unvested rewards", async () => {
        const fiduToMigrate = fiduAmount.div(new BN(2))

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor1})

        const originalTokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)

        await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})
        await stakingRewards.kick(originalTokenId)

        const stakedPositionBefore = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()

        await stakingRewards.approve(zapper.address, originalTokenId, {from: investor1})

        const receipt = await zapper.zapStakeToCurve(originalTokenId, fiduToMigrate, new BN(0), {from: investor1})

        const stakedPositionAfter = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()

        const curveLPAmount = await fiduUSDCCurveLP.calc_token_amount([fiduToMigrate, new BN(0)])

        const newTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        // it maintains investor as owner of staked position
        expect(await stakingRewards.ownerOf(originalTokenId)).to.eq(investor1)

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
        expect(await stakingRewards.ownerOf(newTokenId)).to.eq(investor1)
        expect(await stakingRewards.stakedBalanceOf(newTokenId)).to.bignumber.eq(curveLPAmount)
      })
    })

    context("for a FIDU and USDC migration", async () => {
      it("creates a new staked position without slashing unvested rewards", async () => {
        // Stake FIDU
        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor1})
        const originalTokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)

        // Migrate half of the FIDU, along with USDC
        const fiduToMigrate = fiduAmount.div(new BN(2))
        const usdcToDeposit = usdcVal(100)

        // Update rewards for position
        await advanceTime({seconds: SECONDS_PER_YEAR.div(new BN(2))})
        await stakingRewards.kick(originalTokenId)

        const usdcAmountBefore = await usdc.balanceOf(investor1)
        const stakedPositionBefore = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyBefore = await stakingRewards.totalStakedSupply()

        // Zap stake to Curve with USDC
        await stakingRewards.approve(zapper.address, originalTokenId, {from: investor1})
        await usdc.approve(zapper.address, usdcToDeposit, {from: investor1})
        const receipt = await zapper.zapStakeToCurve(originalTokenId, fiduToMigrate, usdcToDeposit, {from: investor1})

        const usdcAmountAfter = await usdc.balanceOf(investor1)
        const stakedPositionAfter = (await stakingRewards.positions(originalTokenId)) as any
        const totalStakedSupplyAfter = await stakingRewards.totalStakedSupply()

        const curveLPAmount = await fiduUSDCCurveLP.calc_token_amount([fiduToMigrate, usdcToDeposit])

        const newTokenId = getFirstLog<Staked>(decodeLogs(receipt.receipt.rawLogs, stakingRewards, "Staked")).args
          .tokenId

        // It maintains investor as owner of staked position
        expect(await stakingRewards.ownerOf(originalTokenId)).to.eq(investor1)

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
        expect(await stakingRewards.ownerOf(newTokenId)).to.eq(investor1)
        expect(await stakingRewards.stakedBalanceOf(newTokenId)).to.bignumber.eq(curveLPAmount)
      })
    })

    context("investor does not own position token", async () => {
      it("reverts", async () => {
        // Stake from owner account
        const fiduAmount = bigVal(100)
        await fidu.approve(stakingRewards.address, fiduAmount, {from: owner})

        const ownerStakedTokenId = await stake(owner, fiduAmount, stakingRewards, fidu)

        // Attempt to zap owner staked position as investor
        await expect(
          zapper.zapStakeToCurve(ownerStakedTokenId, fiduAmount, new BN(0), {from: investor1})
        ).to.be.rejectedWith(/Not token owner/)
      })
    })

    context("paused", async () => {
      it("reverts", async () => {
        await zapper.pause({from: owner})

        await fidu.approve(stakingRewards.address, fiduAmount, {from: investor1})

        const tokenId = await stake(investor1, fiduAmount, stakingRewards, fidu)

        await expect(zapper.zapStakeToCurve(tokenId, fiduAmount, new BN(0), {from: investor1})).to.be.rejectedWith(
          /paused/
        )
      })
    })
  })
})

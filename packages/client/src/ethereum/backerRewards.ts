import {BackerRewards as BackerRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/BackerRewards"
import BigNumber from "bignumber.js"
import difference from "lodash/difference"
import mapValues from "lodash/mapValues"
import zipObject from "lodash/zipObject"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../types/loadable"
import {
  ByTranchedPool,
  EstimatedRewards,
  EstimatedRewardsByTranchedPool,
  ForTranchedPool,
  RepaymentSchedule,
  RepaymentSchedulesByTranchedPool,
  ScheduledRepayment,
  ScheduledRepaymentEstimatedReward,
} from "../types/tranchedPool"
import {Web3IO} from "../types/web3"
import {assertNonNullable, BlockInfo, defaultSum, displayDollars, displayNumber, sameBlock} from "../utils"
import {usdcFromAtomic} from "./erc20"
import {gfiFromAtomic, GFILoaded, gfiToDollarsAtomic, GFI_DECIMALS} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {SeniorPoolLoaded} from "./pool"
import {PoolState, TranchedPool, TranchedPoolBacker} from "./tranchedPool"
import {DAYS_PER_YEAR, USDC_DECIMALS} from "./utils"

type BackerRewardsLoadedInfo = {
  currentBlock: BlockInfo
  isPaused: boolean
  maxInterestDollarsEligible: BigNumber
  totalRewardPercentOfTotalGFI: BigNumber
  // The block from which tranched pools created henceforth are able to earn GFI through
  // the BackerRewards contract.
  startBlock: BlockInfo
}

export type BackerRewardsLoaded = WithLoadedInfo<BackerRewards, BackerRewardsLoadedInfo>

export class BackerRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<BackerRewardsContract>
  address: string
  info: Loadable<BackerRewardsLoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<BackerRewardsContract>("BackerRewards")
    this.address = goldfinchProtocol.getAddress("BackerRewards")
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(currentBlock: BlockInfo): Promise<void> {
    const [isPaused, maxInterestDollarsEligible, totalRewardPercentOfTotalGFI] = await Promise.all([
      this.contract.readOnly.methods.paused().call(undefined, currentBlock.number),
      this.contract.readOnly.methods.maxInterestDollarsEligible().call(undefined, currentBlock.number),
      this.contract.readOnly.methods.totalRewardPercentOfTotalGFI().call(undefined, currentBlock.number),
    ])

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        isPaused,
        maxInterestDollarsEligible: new BigNumber(maxInterestDollarsEligible),
        totalRewardPercentOfTotalGFI: new BigNumber(totalRewardPercentOfTotalGFI),
        startBlock: this.goldfinchProtocol.networkIsMainnet
          ? {
              number: 14142864,
              timestamp: 1644021439,
            }
          : // If we're not on mainnet -- e.g. we're on the local network -- we'll define the
            // start block such that effectively all tranched pools are eligible for backer rewards.
            // If you want to test the scenario where only some tranched pools are eligible for
            // backer rewards, you can overwrite this to be a value that is meaningful for the network
            // you're testing on.
            {
              number: 1,
              timestamp: 1,
            },
      },
    }
  }

  /**
   * Whether we'd expect calling `BackerRewards.withdraw()` for a junior-tranche pool token
   * belonging to `tranchedPool` to succeed. Thus the definition here should correspond to
   * the conditions in `BackerRewards.withdraw()` that prevent withdrawing rewards.
   */
  juniorTranchePoolTokenRewardsAreNotWithdrawableReason(
    tranchedPool: TranchedPool
  ): BackerRewardsNotWithdrawableReason {
    assertWithLoadedInfo(this)
    return this.info.value.isPaused
      ? "backerRewardsPaused"
      : tranchedPool.isPaused
      ? "poolPaused"
      : tranchedPool.creditLine.isLate
      ? "late"
      : undefined
  }

  filterRewardsEligibleTranchedPools(tranchedPools: TranchedPool[]): TranchedPool[] {
    assertWithLoadedInfo(this)
    const loadedInfo = this.info.value
    return tranchedPools.filter((tranchedPool: TranchedPool): boolean => {
      const eligible =
        tranchedPool.creditLine.termStartTime.isZero() ||
        tranchedPool.creditLine.termStartTime.toNumber() >= loadedInfo.startBlock.timestamp
      return eligible
    })
  }
  filterRewardableTranchedPools(tranchedPools: TranchedPool[]): TranchedPool[] {
    return this.filterRewardsEligibleTranchedPools(tranchedPools).filter((tranchedPool: TranchedPool): boolean => {
      // If a borrower is late on their payment, the rewards earned by their backers are not claimable. And
      // we don't know whether those rewards will ever become claimable again (because we don't know whether the
      // borrower will become current again). So the UX we must serve is not to represent the tranched pool
      // as earning rewards.
      const current = !tranchedPool.creditLine.isLate
      return current
    })
  }

  private sortScheduledRepayments(
    repaymentSchedules: RepaymentSchedulesByTranchedPool
  ): ForTranchedPool<ScheduledRepayment>[] {
    const tranchedPoolAddresses = Object.keys(repaymentSchedules)
    const concatenated = tranchedPoolAddresses.reduce<ForTranchedPool<ScheduledRepayment>[]>((acc, curr) => {
      const repaymentSchedule = repaymentSchedules[curr]
      assertNonNullable(repaymentSchedule)
      return acc.concat(
        repaymentSchedule.value.map((scheduledRepayment) => ({
          tranchedPool: repaymentSchedule.tranchedPool,
          value: scheduledRepayment,
        }))
      )
    }, [])
    const sorted = concatenated.sort((a, b) => {
      // Primarily sort in chronological order.
      const primary = a.value.timestamp - b.value.timestamp
      if (primary) {
        return primary
      }

      // Secondarily sort in chronological order of the tranched pool's launch time. We need some way of breaking
      // ties in the primary sorting, in case two pools are simultaneously open for the first time (i.e. and
      // therefore we have supposed the same optimistic start time to their loan term). Of course, this way of
      // breaking ties will not necessarily correspond to the order in which the pools actually end up borrowing,
      // but it is a reasonable approach consistent with the impartiality of our assumption, in calculating the expected
      // repayment schedule of an open pool, that an open pool fills up. If we want to do better than this, I think
      // we need to calculate a range: assuming all open pools have the same payment frequency, the max rewards for
      // a given open pool would come from the scenario where that pool borrows before all other open pools, and the
      // min rewards would come from the scenario where every other open pool ends up borrowing before this pool.
      const aSecondary = a.tranchedPool.metadata?.launchTime
      const bSecondary = b.tranchedPool.metadata?.launchTime
      const secondary =
        aSecondary && bSecondary
          ? aSecondary - bSecondary
          : aSecondary && !bSecondary
          ? -1
          : !aSecondary && bSecondary
          ? 1
          : 0
      if (secondary) {
        return secondary
      }

      // Tertiarily sort by tranched pool address, for the sake of deterministic ordering.
      const tertiary = a.tranchedPool.address.localeCompare(b.tranchedPool.address)
      return tertiary
    })
    return sorted
  }

  private async reduceScheduledRepaymentsToEstimatedRewards(
    scheduledRepayments: ForTranchedPool<ScheduledRepayment>[],
    gfiSupply: BigNumber,
    currentBlock: BlockInfo
  ): Promise<ForTranchedPool<ScheduledRepaymentEstimatedReward>[]> {
    assertWithLoadedInfo(this)
    const maxInterestDollarsEligible = this.info.value.maxInterestDollarsEligible
    const totalRewardPercentOfTotalGFI = this.info.value.totalRewardPercentOfTotalGFI
    const totalInterestReceived = new BigNumber(
      await this.contract.readOnly.methods.totalInterestReceived().call(undefined, currentBlock.number)
    )

    const reduced = scheduledRepayments.reduce<{
      interestSumCapped: BigNumber
      estimatedRewards: ForTranchedPool<ScheduledRepaymentEstimatedReward>[]
    }>(
      (acc, curr) => {
        const oldInterestSumCapped = acc.interestSumCapped
        const _newInterestSum = oldInterestSumCapped.plus(
          curr.value.usdcAmount.multipliedBy(GFI_DECIMALS).dividedBy(USDC_DECIMALS.toString())
        )
        const newInterestSumCapped = BigNumber.min(_newInterestSum, maxInterestDollarsEligible)

        const sqrtDiff = newInterestSumCapped.sqrt().minus(oldInterestSumCapped.sqrt())
        const gfiAmount = sqrtDiff
          .multipliedBy(totalRewardPercentOfTotalGFI)
          // NOTE: We divide-to-integer as this replicates the contract's integer division.
          .dividedToIntegerBy(maxInterestDollarsEligible.sqrt())
          .dividedToIntegerBy(100)
          .multipliedBy(gfiSupply)
          .dividedBy(GFI_DECIMALS)

        const newEstimatedRewards = acc.estimatedRewards.concat([
          {
            tranchedPool: curr.tranchedPool,
            value: {
              timestamp: curr.value.timestamp,
              gfiAmount,
            },
          },
        ])

        return {
          interestSumCapped: newInterestSumCapped,
          estimatedRewards: newEstimatedRewards,
        }
      },
      {
        // Initialize the working interest sum using the total amount of interest dollars for which the BackerRewards
        // contract has already granted rewards. This is critical so that the scheduled repayments are considered
        // in the correct relation to repayments that have already occurred.
        interestSumCapped: totalInterestReceived.multipliedBy(GFI_DECIMALS).dividedBy(USDC_DECIMALS.toString()),
        estimatedRewards: [],
      }
    )
    return reduced.estimatedRewards
  }

  private sumScheduledRepaymentsEstimatedRewards(
    estimatedRewards: ForTranchedPool<ScheduledRepaymentEstimatedReward>[]
  ): ByTranchedPool<BigNumber> {
    return estimatedRewards.reduce<ByTranchedPool<BigNumber>>(
      (acc, curr) => ({
        ...acc,
        [curr.tranchedPool.address]: {
          tranchedPool: curr.tranchedPool,
          value: (acc[curr.tranchedPool.address]?.value || new BigNumber(0)).plus(curr.value.gfiAmount),
        },
      }),
      {}
    )
  }

  async _estimateRewardsFromScheduledRepayments(
    tranchedPools: TranchedPool[],
    gfiSupply: BigNumber,
    currentBlock: BlockInfo
  ): Promise<ByTranchedPool<BigNumber>> {
    const repaymentSchedules: RepaymentSchedule[] = await Promise.all(
      tranchedPools.map((tranchedPool) => tranchedPool.getOptimisticRepaymentSchedule(currentBlock))
    )
    const repaymentSchedulesByTranchedPool: RepaymentSchedulesByTranchedPool = zipObject(
      tranchedPools.map((tranchedPool) => tranchedPool.address),
      tranchedPools.map((tranchedPool, i) => {
        const repaymentSchedule = repaymentSchedules[i]
        assertNonNullable(repaymentSchedule)
        return {
          tranchedPool,
          value: repaymentSchedule,
        }
      })
    )
    const scheduledRepayments = this.sortScheduledRepayments(repaymentSchedulesByTranchedPool)
    const scheduledRepaymentsEstimatedRewards = await this.reduceScheduledRepaymentsToEstimatedRewards(
      scheduledRepayments,
      gfiSupply,
      currentBlock
    )
    const estimatedRewards = this.sumScheduledRepaymentsEstimatedRewards(scheduledRepaymentsEstimatedRewards)
    return estimatedRewards
  }

  private annualizeRewards(
    estimatedRewardsFromScheduledRepayments: ByTranchedPool<BigNumber>,
    actualRewardsPerPrincipalDollarFromRepayments: ByTranchedPool<BigNumber>
  ): EstimatedRewardsByTranchedPool {
    if (
      difference(
        Object.keys(estimatedRewardsFromScheduledRepayments),
        Object.keys(actualRewardsPerPrincipalDollarFromRepayments)
      ).length
    ) {
      throw new Error("Sets of tranched pools differ.")
    }
    return mapValues(
      estimatedRewardsFromScheduledRepayments,
      (estimated, tranchedPoolAddress): ForTranchedPool<EstimatedRewards> => {
        // HACK: For now, because no tranched pools yet exist that have more than one slice, we
        // can get away with using (i.e. it remains correct to use) simply a tranched pool's first
        // slice's junior tranche's `principalDeposited`.
        // TODO: Once tranched pools exist having more than one slice, we MUST refactor this
        // to sum the junior tranche's principal-deposited across slices.
        const juniorPrincipalAlreadyBorrowed = estimated.tranchedPool.totalDeposited.gt(0)
          ? estimated.tranchedPool.totalDeployed
              .multipliedBy(estimated.tranchedPool.juniorTranche.principalDeposited)
              .dividedBy(estimated.tranchedPool.totalDeposited)
          : new BigNumber(0)

        const optimisticAdditionalPrincipalToBeBorrowed =
          estimated.tranchedPool.poolState < PoolState.SeniorLocked
            ? estimated.tranchedPool.creditLine.maxLimit.minus(estimated.tranchedPool.totalDeployed)
            : new BigNumber(0)
        const juniorOptimisticAdditionalPrincipalToBeBorrowed = optimisticAdditionalPrincipalToBeBorrowed.dividedBy(
          estimated.tranchedPool.estimatedLeverageRatio.plus(1)
        )

        // NOTE: The basic idea here is that we must calculate principal dollars in a way that is logically
        // consistent with how we calculated the repayment schedule from which the `estimated` rewards were
        // estimated. So the total principal consists of two parts -- that already borrowed, plus an
        // optimistic amount if the pool is not locked -- analogously to how we do in
        // `TranchedPool.getOptimisticRepaymentSchedule()`.
        const principalDollars = juniorPrincipalAlreadyBorrowed.plus(juniorOptimisticAdditionalPrincipalToBeBorrowed)

        const estimatedPerPrincipalDollar = estimated.value
          .multipliedBy(USDC_DECIMALS.toString())
          .dividedBy(principalDollars)

        const actualPerPrincipalDollar = actualRewardsPerPrincipalDollarFromRepayments[tranchedPoolAddress]
        assertNonNullable(actualPerPrincipalDollar)

        const totalPerPrincipalDollar = estimatedPerPrincipalDollar.plus(actualPerPrincipalDollar.value)
        // We annualize the estimated total amount of rewards (i.e. rewards actually earned on interest repayments that
        // have already been made, plus estimated rewards on repayments that are scheduled for the future) by taking
        // a simple annual average. The alternative approach, of picking some particular single year of the loan
        // term and/or some particular slice of the loan, would be (1) more complicated because it would require
        // separating the interest accrued by different slices across a particular stretch of time, and (2) is not
        // necessarily superior as a measure of GFI-return-on-investment.
        const annualizedPerPrincipalDollar = totalPerPrincipalDollar.dividedBy(
          estimated.tranchedPool.creditLine.termInDays.dividedBy(new BigNumber(DAYS_PER_YEAR))
        )

        return {
          tranchedPool: estimated.tranchedPool,
          value: {
            annualizedPerPrincipalDollar,
          },
        }
      }
    )
  }

  private async getActualRewardsPerPrincipalDollarFromRepayments(
    tranchedPools: TranchedPool[],
    currentBlock: BlockInfo
  ): Promise<ByTranchedPool<BigNumber>> {
    // For each tranched pool, how many rewards have accrued to the backers of the pool?
    // To answer this, it's not enough to look at `accRewardsPerPrincipalDollar` and
    // multiply by the number of principal dollars, because if the pool has multiple
    // slices, then not every principal dollar will have earned that amount of rewards
    // (instead, the principal dollars belonging to non-first slices will have earned
    // the difference between (i) the value of that accumulator at the time they were
    // deposited and (ii) the current value of that accumulator). So the naive solution
    // to obtaining this total would be to iterate over each pool token belonging to the
    // tranched pool, summing up ( ( the pool's `accRewardsPerPrincipalDollar` minus the
    // pool token's `accRewardsPerPrincipalDollarAtMint` ) * ( the pool token's junior-tranche
    // principal deposited amount ) ).
    //
    // HACK: For now, because no tranched pools yet exist that have more than one slice, we
    // can get away with using / it remains correct to use simply the pool's
    // `accRewardsPerPrincipalDollar`.
    // TODO: Once tranched pools exist having more than one slice, we MUST refactor this
    // to implement the summing-across-pool-tokens approach.

    const actualPerPrincipalDollar = await Promise.all(
      tranchedPools.map(async (tranchedPool): Promise<ForTranchedPool<BigNumber>> => {
        const backerRewardsInfo = await this.contract.readOnly.methods
          .pools(tranchedPool.address)
          .call(undefined, currentBlock.number)
        const accRewardsPerPrincipalDollar = new BigNumber(backerRewardsInfo)
        return {tranchedPool, value: accRewardsPerPrincipalDollar}
      })
    )
    const tranchedPoolAddresses = tranchedPools.map((tranchedPool) => tranchedPool.address)
    return zipObject(tranchedPoolAddresses, actualPerPrincipalDollar)
  }

  private async estimateBackersOnlyRewardsByTranchedPool(
    rewardable: TranchedPool[],
    gfiSupply: BigNumber,
    currentBlock: BlockInfo
  ): Promise<EstimatedRewardsByTranchedPool> {
    const estimatedRewardsFromScheduledRepayments = await this._estimateRewardsFromScheduledRepayments(
      rewardable,
      gfiSupply,
      currentBlock
    )
    const actualRewardsFromRepayments = await this.getActualRewardsPerPrincipalDollarFromRepayments(
      rewardable,
      currentBlock
    )
    const estimatedRewards = this.annualizeRewards(estimatedRewardsFromScheduledRepayments, actualRewardsFromRepayments)
    return estimatedRewards
  }

  private estimateApyFromAnnualizedBackersOnlyRewards(
    annualizedRewardsPerPrincipalDollar: BigNumber,
    gfiPrice: BigNumber | undefined
  ): BigNumber | undefined {
    return gfiToDollarsAtomic(annualizedRewardsPerPrincipalDollar, gfiPrice)?.dividedBy(GFI_DECIMALS)
  }

  /**
   * Estimates the APY-from-GFI from backing a tranched pool, for the GFI that is available natively / only
   * to backers. That is, this estimation does NOT include the portion of total APY-from-GFI for backers
   * that consists of matching the APY-from-GFI of investing in the Senior Pool.
   *
   * NOTE: This estimate is pool-wide; it is not done *specific to any pool tokens that are already held by
   * the user*. Therefore it represents the APY-from-GFI for an "average dollar" in the pool. This is worth
   * keeping in mind, because any given user's dollars in the pool may not be "average dollars"; the user
   * might, for example, have participated in only some slices but not others. More specifically, because
   * the backers-only rewards function is monotonically decreasing (all other things being equal, i.e.
   * holding constant the max interest dollars eligible and the percent of GFI available for rewards), the
   * user is sure to earn less than this pool-wide APY-from-GFI if they did not participate in all slices.
   */
  private async estimateBackersOnlyApyFromGfiByTranchedPool(
    rewardable: TranchedPool[],
    gfi: GFILoaded
  ): Promise<{[tranchedPoolAddress: string]: BigNumber | undefined}> {
    const estimatedBackersOnlyRewards = await this.estimateBackersOnlyRewardsByTranchedPool(
      rewardable,
      gfi.info.value.supply,
      gfi.info.value.currentBlock
    )
    return mapValues(estimatedBackersOnlyRewards, (rewards) =>
      this.estimateApyFromAnnualizedBackersOnlyRewards(rewards.value.annualizedPerPrincipalDollar, gfi.info.value.price)
    )
  }

  /**
   * Estimates the APY-from-GFI from backing a tranched pool, for the GFI that is earned from BackerRewards's behavior
   * that "matches" the APY-from-GFI (i.e. via StakingRewards) of investing in the senior pool.
   */
  private async estimateSeniorPoolMatchingApyFromGfi(
    rewardable: TranchedPool[],
    seniorPool: SeniorPoolLoaded
  ): Promise<{[tranchedPoolAddress: string]: BigNumber | undefined}> {
    return zipObject(
      rewardable.map((tranchedPool) => tranchedPool.address),
      // TODO Once BackerRewards's senior-pool-matching behavior has been implemented, we MUST refine this estimate.
      // At any given time in the life of a tranched pool, the estimated senior-pool-matching APY-from-GFI will consist
      // of two parts: (i) the GFI actually earned on time already elapsed, plus (ii) an optimistic projection of the GFI
      // that will be earned over the remaining term of the loan. Conceivably we could calculate (i) and (ii) by summing
      // over the user's pool tokens, if they have any pool tokens; or else reverting to the pool-wide average if the
      // user has no pool tokens. But for consistency with the backers-only APY-from-GFI, we should probably only do the
      // latter, that is, compute it as a pool-wide average. This approach would have the same corollary as in the
      // backers-only case: if the user has not participated in all slices of the pool, they would necessarily not earn
      // this full APY-from-GFI rate. Also, note a couple nuances about the calculation: (1) in (i), there is a part that must be calculated for the partial
      // payment period duration between the last payment time and the current time (i.e. we'll need to query for
      // the current value of the staking rewards accumulator); (2) the calculation must "cut off" at the term end time,
      // in both the case where the term end time belongs to (i) or the case where the term end time belongs to (ii).
      rewardable.map((tranchedPool) => seniorPool.info.value.poolData.estimatedApyFromGfi)
    )
  }

  async estimateApyFromGfiByTranchedPool(
    tranchedPools: TranchedPool[],
    seniorPool: SeniorPoolLoaded,
    gfi: GFILoaded
  ): Promise<{
    [tranchedPoolAddress: string]:
      | {
          backersOnly: BigNumber | undefined
          seniorPoolMatching: BigNumber | undefined
        }
      | undefined
  }> {
    if (!sameBlock(seniorPool.info.value.currentBlock, this.info.value?.currentBlock)) {
      throw new Error("Senior pool `currentBlock` is not consistent with BackerRewards' current block.")
    }
    if (!sameBlock(gfi.info.value.currentBlock, this.info.value?.currentBlock)) {
      throw new Error("GFI `currentBlock` is not consistent with BackerRewards' current block.")
    }

    const tranchedPoolAddresses = tranchedPools.map((tranchedPool) => tranchedPool.address)
    const notEarningGfi = tranchedPools.map(() => undefined)
    const defaultEstimatedApyFromGfi = zipObject(tranchedPoolAddresses, notEarningGfi)

    const rewardableTranchedPools = this.filterRewardableTranchedPools(tranchedPools)

    const [estimatedBackersOnlyApyFromGfi, estimatedSeniorPoolMatchingApyFromGfi] = await Promise.all([
      this.estimateBackersOnlyApyFromGfiByTranchedPool(rewardableTranchedPools, gfi),
      this.estimateSeniorPoolMatchingApyFromGfi(rewardableTranchedPools, seniorPool),
    ])

    const rewardableEstimatedApyFromGfi = zipObject(
      rewardableTranchedPools.map((rewardable) => rewardable.address),
      rewardableTranchedPools.map((rewardable) => ({
        backersOnly: estimatedBackersOnlyApyFromGfi[rewardable.address],
        seniorPoolMatching: estimatedSeniorPoolMatchingApyFromGfi[rewardable.address],
      }))
    )

    return {
      ...defaultEstimatedApyFromGfi,
      ...rewardableEstimatedApyFromGfi,
    }
  }
}

export type BackerRewardsPoolTokenPosition = {
  tokenId: string
  claimed: {
    backersOnly: BigNumber
    seniorPoolMatching: BigNumber
  }
  claimable: {
    backersOnly: BigNumber
    seniorPoolMatching: BigNumber
  }
  unvested: {
    backersOnly: BigNumber
    seniorPoolMatching: BigNumber
  }
}

export type BackerRewardsNotWithdrawableReason = "backerRewardsPaused" | "poolPaused" | "late" | undefined

/**
 * Models a user's position in terms of backer rewards, as the backer of a tranched pool.
 */
export class BackerRewardsPosition {
  backer: TranchedPoolBacker
  firstDepositTime: number
  rewardsNotWithdrawableReason: BackerRewardsNotWithdrawableReason
  tokenPositions: BackerRewardsPoolTokenPosition[]

  constructor(
    backer: TranchedPoolBacker,
    firstDepositTime: number,
    rewardsNotWithdrawableReason: BackerRewardsNotWithdrawableReason,
    tokenPositions: BackerRewardsPoolTokenPosition[]
  ) {
    this.backer = backer
    this.firstDepositTime = firstDepositTime
    this.rewardsNotWithdrawableReason = rewardsNotWithdrawableReason
    this.tokenPositions = tokenPositions
  }

  get title(): string {
    return `Backer of ${this.backer.tranchedPool.metadata?.name || `Pool ${this.backer.tranchedPool.address}`}`
  }

  get description(): string {
    const transactionDate = new Date(this.firstDepositTime * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    const principalDepositedAmount = usdcFromAtomic(this.backer.principalAmount)
    const principalRemainingAmount = usdcFromAtomic(this.backer.principalAtRisk)
    return `Supplied ${displayDollars(principalDepositedAmount, 2)} USDC beginning on ${transactionDate}${
      principalDepositedAmount === principalRemainingAmount
        ? ""
        : ` (${displayDollars(principalRemainingAmount, 2)} USDC remaining)`
    }`
  }

  get shortDescription(): string {
    const transactionDate = new Date(this.firstDepositTime * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    return `${displayNumber(gfiFromAtomic(this.granted))} GFI • ${transactionDate}`
  }

  get granted(): BigNumber {
    return this.vested.plus(this.unvested)
  }

  get vested(): BigNumber {
    return this.claimed.plus(this.claimable)
  }

  get unvested(): BigNumber {
    return defaultSum(
      this.tokenPositions.map((tokenPosition) =>
        tokenPosition.unvested.backersOnly.plus(tokenPosition.unvested.seniorPoolMatching)
      )
    )
  }

  get claimed(): BigNumber {
    return defaultSum(
      this.tokenPositions.map((tokenPosition) =>
        tokenPosition.claimed.backersOnly.plus(tokenPosition.claimed.seniorPoolMatching)
      )
    )
  }

  get claimable(): BigNumber {
    return defaultSum(
      this.tokenPositions.map((tokenPosition) =>
        tokenPosition.claimable.backersOnly.plus(tokenPosition.claimable.seniorPoolMatching)
      )
    )
  }
}

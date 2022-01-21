import {BackerRewards as BackerRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/BackerRewards"
import BigNumber from "bignumber.js"
import difference from "lodash/difference"
import mapValues from "lodash/mapValues"
import zipObject from "lodash/zipObject"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {
  ByTranchedPool,
  ScheduledRepaymentEstimatedReward,
  EstimatedRewardsByTranchedPool,
  ForTranchedPool,
  RepaymentSchedulesByTranchedPool,
  ScheduledRepayment,
  EstimatedRewards,
  RepaymentSchedule,
} from "../types/tranchedPool"
import {Web3IO} from "../types/web3"
import {assertNonNullable, BlockInfo, sameBlock} from "../utils"
import {gfiToDollarsAtomic, GFI_DECIMALS} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {TranchedPool} from "./tranchedPool"
import {DAYS_PER_YEAR, USDC_DECIMALS} from "./utils"

type BackerRewardsLoadedInfo = {
  currentBlock: BlockInfo
  isPaused: boolean
  maxInterestDollarsEligible: BigNumber
  totalRewardPercentOfTotalGFI: BigNumber
}

export type BackerRewardsLoaded = WithLoadedInfo<BackerRewards, BackerRewardsLoadedInfo>

export class BackerRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<BackerRewardsContract>
  address: string
  info: Loadable<BackerRewardsLoadedInfo>
  startBlock: BlockInfo = {
    number: 1, // TODO[PR]
    timestamp: 1000, // TODO[PR]
  }

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
      },
    }
  }

  filterRewardableTranchedPools(tranchedPools: TranchedPool[]): TranchedPool[] {
    return tranchedPools.filter((tranchedPool: TranchedPool): boolean => {
      const eligible = tranchedPool.creditLine.termStartTime.toNumber() > this.startBlock.timestamp
      // If a borrower is late on their payment, the rewards earned by their backers are not claimable. And
      // we don't know whether those rewards will ever become claimable again (because we don't know whether the
      // borrower will become current again). So the UX we must serve is not to represent the tranched pool
      // as earning rewards.
      const current = !tranchedPool.creditLine.isLate
      return eligible && current
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
    const sorted = concatenated.sort((a, b) => a.value.timestamp - b.value.timestamp)
    return sorted
  }

  private async reduceScheduledRepaymentsToEstimatedRewards(
    scheduledRepayments: ForTranchedPool<ScheduledRepayment>[],
    gfiSupply: BigNumber
  ): Promise<ForTranchedPool<ScheduledRepaymentEstimatedReward>[]> {
    const maxInterestDollarsEligible = this.info.value?.maxInterestDollarsEligible
    assertNonNullable(maxInterestDollarsEligible)
    const totalRewardPercentOfTotalGFI = this.info.value?.totalRewardPercentOfTotalGFI
    assertNonNullable(totalRewardPercentOfTotalGFI)

    const reduced = scheduledRepayments.reduce<{
      interestSumCapped: BigNumber
      estimatedRewards: ForTranchedPool<ScheduledRepaymentEstimatedReward>[]
    }>(
      (acc, curr) => {
        const oldInterestSumCapped = acc.interestSumCapped
        const _newInterestSum = oldInterestSumCapped.plus(
          curr.value.usdcAmount.multipliedBy(GFI_DECIMALS).dividedBy(USDC_DECIMALS.toString())
        )
        const newInterestSumCapped = BigNumber.max(_newInterestSum, maxInterestDollarsEligible)

        const sqrtDiff = newInterestSumCapped.sqrt().minus(oldInterestSumCapped.sqrt())
        const gfiAmount = sqrtDiff
          .multipliedBy(totalRewardPercentOfTotalGFI)
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
        interestSumCapped: new BigNumber(0),
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

  private async estimateRewardsFromScheduledRepayments(
    tranchedPools: TranchedPool[],
    gfiSupply: BigNumber,
    currentBlock: BlockInfo
  ): Promise<ByTranchedPool<BigNumber>> {
    const repaymentSchedules: RepaymentSchedule[] = await Promise.all(
      tranchedPools.map((tranchedPool) => tranchedPool.getRepaymentSchedule(currentBlock))
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
      gfiSupply
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
      )
    ) {
      throw new Error("Sets of tranched pools differ.")
    }
    return mapValues(
      estimatedRewardsFromScheduledRepayments,
      (estimated, tranchedPoolAddress): ForTranchedPool<EstimatedRewards> => {
        const estimatedPerPrincipalDollar = estimated.value.multipliedBy(USDC_DECIMALS.toString()).dividedBy(
          // HACK: For now, because no tranched pools yet exist that have more than one slice, we
          // can get away with using (i.e. it remains correct to use) simply a tranched pool's first
          // slice's junior tranche's `principalDeposited`.
          // TODO: Once tranched pools exist having more than one slice, we MUST refactor this
          // to sum the junior tranche's principal-deposited across slices.

          // TODO[PR] Is this actually-deposited amount the correct one to use? We need to use a principal amount
          // that corresponds to the amount used as the basis for projecting interest repayments.  The actually-deposited
          // amount would be correct if scheduled interest repayments were calculated using the actual balance
          // on the credit line -- which is a fine approach, except that a new pool that is still open won't
          // have a balance yet (similarly, the balance of an existing pool with an open non-first slice wouldn't
          // reflect what the pool balance *would be* if it were to be fully funded), so we'd project 0 in interest
          // repayments for it, so it would earn an estimated 0 rewards, so its APY-from-GFI would be 0...
          estimated.tranchedPool.juniorTranche.principalDeposited
        )

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

  private async estimateRewardsByTranchedPool(
    tranchedPools: TranchedPool[],
    gfiSupply: BigNumber,
    currentBlock: BlockInfo
  ): Promise<EstimatedRewardsByTranchedPool> {
    const rewardable = this.filterRewardableTranchedPools(tranchedPools)
    const estimatedRewardsFromScheduledRepayments = await this.estimateRewardsFromScheduledRepayments(
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

  private estimateApyFromAnnualizedRewards(
    annualizedRewardsPerPrincipalDollar: BigNumber,
    gfiPrice: BigNumber | undefined
  ): BigNumber | undefined {
    return gfiToDollarsAtomic(annualizedRewardsPerPrincipalDollar, gfiPrice)?.dividedBy(GFI_DECIMALS)
  }

  async estimateApyFromGfiByTranchedPool(
    tranchedPools: TranchedPool[],
    gfiSupply: BigNumber,
    gfiPrice: BigNumber | undefined,
    currentBlock: BlockInfo
  ): Promise<{[tranchedPoolAddress: string]: BigNumber | undefined}> {
    if (!sameBlock(currentBlock, this.info.value?.currentBlock)) {
      throw new Error("`currentBlock` is not consistent with BackerRewards' current block.")
    }

    const tranchedPoolAddresses = tranchedPools.map((tranchedPool) => tranchedPool.address)
    const noEstimate = tranchedPools.map(() => undefined)
    const defaultEstimatedApyFromGfi = zipObject(tranchedPoolAddresses, noEstimate)

    const estimatedRewards = await this.estimateRewardsByTranchedPool(tranchedPools, gfiSupply, currentBlock)
    const estimatedApyFromGfi = mapValues(estimatedRewards, (rewards) =>
      this.estimateApyFromAnnualizedRewards(rewards.value.annualizedPerPrincipalDollar, gfiPrice)
    )

    return {
      ...defaultEstimatedApyFromGfi,
      ...estimatedApyFromGfi,
    }
  }
}

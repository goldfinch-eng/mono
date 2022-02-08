import BigNumber from "bignumber.js"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {GFI} from "../../ethereum/gfi"
import {CapitalProvider, SeniorPoolData} from "../../ethereum/pool"
import {PoolState, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {Loaded} from "../../types/loadable"
import {InfoIcon} from "../../ui/icons"
import {displayDollars, displayPercent, roundDownPenny} from "../../utils"
import AnnualGrowthTooltipContent from "../AnnualGrowthTooltipContent"
import {TranchedPoolsEstimatedApyFromGfi} from "./types"

export default function PortfolioOverview({
  seniorPoolData,
  capitalProvider,
  tranchedPoolBackers,
  tranchedPoolsEstimatedApyFromGfi,
}: {
  seniorPoolData: SeniorPoolData
  capitalProvider: Loaded<CapitalProvider>
  tranchedPoolBackers: Loaded<TranchedPoolBacker[]>
  tranchedPoolsEstimatedApyFromGfi: Loaded<TranchedPoolsEstimatedApyFromGfi>
}) {
  const seniorPoolBalance = capitalProvider.value.totalSeniorPoolBalanceInDollars
  const estimatedAnnualGrowthFromSupplyingToSeniorPool = seniorPoolBalance.multipliedBy(seniorPoolData.estimatedApy)
  const seniorPoolUnrealizedGains = capitalProvider.value.unrealizedGainsInDollars

  let tranchedPoolsBalance = new BigNumber(0)
  let estimatedAnnualGrowthFromSupplyingToTranchedPools = new BigNumber(0)
  let tranchedPoolsUnrealizedGains = new BigNumber(0)
  let tranchedPoolsBalanceEarningGfi = new BigNumber(0)
  let tranchedPoolsGfi: Array<{
    address: string
    balanceEarningGfi: BigNumber
    estimatedApyFromGfi: BigNumber
  }> = []
  tranchedPoolBackers.value.forEach((p) => {
    tranchedPoolsBalance = tranchedPoolsBalance.plus(p.balanceInDollars)
    tranchedPoolsUnrealizedGains = tranchedPoolsUnrealizedGains.plus(p.unrealizedGainsInDollars)
    const estimatedJuniorApy = p.tranchedPool.estimateJuniorAPY(p.tranchedPool.estimatedLeverageRatio)
    estimatedAnnualGrowthFromSupplyingToTranchedPools = estimatedAnnualGrowthFromSupplyingToTranchedPools.plus(
      p.balanceInDollars.multipliedBy(estimatedJuniorApy)
    )

    const tranchedPoolEstimatedApyFromGfi =
      tranchedPoolsEstimatedApyFromGfi.value.estimatedApyFromGfi[p.tranchedPool.address]
    if (tranchedPoolEstimatedApyFromGfi) {
      const {backersOnly, seniorPoolMatching} = tranchedPoolEstimatedApyFromGfi
      if (backersOnly || seniorPoolMatching) {
        // HACK: For now, because no tranched pools yet exist that have more than one slice, we
        // can get away with using (i.e. it remains correct to use) `p`'s sums across all pool tokens.
        // TODO: Once tranched pools exist having more than one slice, we MUST refactor this
        // to distinguish, when we sum, between pool tokens belonging to slices that are closed vs.
        // pool tokens belonging to slices that are open.
        const _balanceAtomicEarningGfi =
          p.tranchedPool.poolState < PoolState.SeniorLocked
            ? p.principalAmount.minus(p.principalRedeemed)
            : p.principalAtRisk
        const _balanceInDollarsEarningGfi = new BigNumber(usdcFromAtomic(_balanceAtomicEarningGfi))

        let balanceInDollarsEarningBackersOnlyGfi = new BigNumber(0)
        if (backersOnly) {
          // How much of the principal the user has supplied has earned / is earning GFI rewards at the
          // `backersOnly` rate? The definition of this principal amount needs to
          // correspond to / be consistent with how we defined the total amount of (junior) principal
          // dollars in the tranched pool that are earning GFI. The answer is: iterate over the
          // user's pool tokens for a tranched pool, summing (a) if the token corresponds to a closed slice,
          // the token's "at-risk" principal amount (i.e. initial principal minus redeemed amount minus
          // redeemable amount), because this amount corresponds to the size of the claim the token has on
          // repaid interest (which is what these `backersOnly` rewards are earned on); or (b) if the token
          // corresponds to an open slice, the token's principal amount minus its redeemed amount -- but
          // not minus its redeemable amount, because we're assuming the user won't withdraw that withdrawable
          // amount, as that assumption corresponds to our assumption that the pool as a whole fills up.
          //
          // TODO Because this `backersOnly` rate is a pool-wide average -- and therefore the user won't earn
          // this exact amount if their dollars are not "average dollars" (which is sure to be the case if they haven't
          // participated in all slices in the pool, and done so in the same proportion that each slice's
          // principal represents as a share of the pool's total principal) -- we should explain in the docs this
          // aspect of the imprecision of this estimate. Or else, we should refactor our approach not to
          // use a pool-wide average, and instead calculate a separate backers-only rate *per slice*.
          balanceInDollarsEarningBackersOnlyGfi = _balanceInDollarsEarningGfi
        }

        let balanceInDollarsEarningSeniorPoolMatchingGfi = new BigNumber(0)
        if (seniorPoolMatching) {
          // How much of the principal the user has supplied has earned / is earning GFI rewards at the
          // `seniorPoolMatching` rate? The user will actually earn senior-pool-matching GFI over the
          // duration of time that we define as it being "virtually staked": after the loan principal
          // has been drawndown, and until the term end time of the loan. For simplicity of implementation,
          // and intuitiveness of the UX (i.e. we want the user's seeing this APY reflected in their portfolio
          // overview to correspond to their knowledge of whether they have a balance in the pool; rather than
          // also whether the pool has yet been drawndown, or has passed its term end time), we will not
          // adjust this figure for whether we're before the first drawdown or after the term end time.
          // Therefore the relevant principal amount is the same amount as that earning the `backersOnly`
          // rate: it is the sum across the user's pool tokens of: (a) if the token corresponds to a closed
          // slice, the token's "at-risk" principal amount (because this amount represents the opportunity
          // cost of investing in the tranched pool, instead of in the senior pool, where it could have earned
          // the senior pool's APY-from-GFI from staking); or (b) if the token corresponds to an open slice,
          // the token's principal amount minus its redeemed amount, as we want to assume that the user won't
          // withdraw their redeemable (i.e. withdrawable) amount and instead will earn GFI rewards on that
          // amount.
          //
          // TODO Analogous comment here as in the `backersOnly` case, regarding explaining in the docs the
          // imprecision of this estimate because `seniorPoolMatching` is a pool-wide average (i.e. and therefore
          // the user won't earn this much if they haven't participated in all slices in the pool, and done so
          // in the same proportion that each slice's principal represents as a share of the pool's total
          // principal). Or else refactor our approach not to use a pool-wide average, and instead
          // calculate a separate rate *per slice*.
          balanceInDollarsEarningSeniorPoolMatchingGfi = _balanceInDollarsEarningGfi
        }

        // The overall APY-from-GFI for the tranched pool is the sum of the backers-only portion
        // and the senior-pool-matching portion, with each of those portions *weighted by the
        // respective percentage of the user's total balance in the pool that is earning that
        // APY*.
        const estimatedApyFromGfi = (backersOnly || new BigNumber(0))
          .multipliedBy(balanceInDollarsEarningBackersOnlyGfi)
          .dividedBy(p.balanceInDollars)
          .plus(
            (seniorPoolMatching || new BigNumber(0))
              .multipliedBy(balanceInDollarsEarningSeniorPoolMatchingGfi)
              .dividedBy(p.balanceInDollars)
          )

        tranchedPoolsBalanceEarningGfi = tranchedPoolsBalanceEarningGfi.plus(p.balanceInDollars)
        tranchedPoolsGfi.push({
          address: p.tranchedPool.address,
          balanceEarningGfi: p.balanceInDollars,
          estimatedApyFromGfi,
        })
      }
    }
  })

  const totalBalance = seniorPoolBalance.plus(tranchedPoolsBalance)
  const estimatedAnnualGrowthFromSupplying = estimatedAnnualGrowthFromSupplyingToSeniorPool.plus(
    estimatedAnnualGrowthFromSupplyingToTranchedPools
  )
  const totalUnrealizedGains = seniorPoolUnrealizedGains.plus(tranchedPoolsUnrealizedGains)

  const estimatedApyFromSupplying = totalBalance.gt(0)
    ? estimatedAnnualGrowthFromSupplying.dividedBy(totalBalance)
    : undefined

  const seniorPoolBalanceEarningGfi = capitalProvider.value.stakedSeniorPoolBalanceInDollars
  const estimatedApyFromGfiSeniorPool = GFI.estimateApyFromGfi(
    // NOTE: Because our frontend does not currently support staking with lockup, we do not
    // worry here about adjusting for the portion of the user's balance that is not only earning
    // GFI from staking, but is earning that GFI at a boosted rate due to having staked-with-lockup.
    seniorPoolBalanceEarningGfi,
    seniorPoolBalance,
    seniorPoolData.estimatedApyFromGfi
  )

  // Tranched pools' APY-from-GFI is a two-step calculation. First, we take the average of the
  // APY-from-GFI for each tranched-pool-that-earns-GFI, weighted by how much the user has
  // supplied to those pools that is earning GFI at that rate. That gives us a
  // weighted average APY-from-GFI for the user's dollars that are earning GFI. But not necessarily
  // all of the user's dollars supplied to tranched pools are earning GFI! Which points to the
  // need for the second step in the calculation: we adjust the weighted average from the
  // first step, for the percentage of dollars that are earning GFI, out of the user's
  // total dollars supplied to tranched pools.
  const estimatedApyFromGfiForTranchedPoolsEarningGfi = tranchedPoolsBalanceEarningGfi.gt(0)
    ? tranchedPoolsGfi.reduce<BigNumber>(
        (acc, curr) =>
          acc.plus(
            curr.estimatedApyFromGfi.multipliedBy(curr.balanceEarningGfi).dividedBy(tranchedPoolsBalanceEarningGfi)
          ),
        new BigNumber(0)
      )
    : undefined
  const estimatedApyFromGfiTranchedPools = GFI.estimateApyFromGfi(
    tranchedPoolsBalanceEarningGfi,
    tranchedPoolsBalance,
    estimatedApyFromGfiForTranchedPoolsEarningGfi
  )

  // Total APY-from-GFI is the average of the senior pool APY-from-GFI and
  // the tranched pools' APY-from-GFI, weighted by how much the user has supplied
  // to the senior pool vs. tranched pools.
  let estimatedApyFromGfi: BigNumber | undefined
  if ((estimatedApyFromGfiSeniorPool || estimatedApyFromGfiTranchedPools) && totalBalance.gt(0)) {
    const seniorPoolPortion = (estimatedApyFromGfiSeniorPool || new BigNumber(0))
      .multipliedBy(seniorPoolBalance)
      .dividedBy(totalBalance)
    const tranchedPoolsPortion = (estimatedApyFromGfiTranchedPools || new BigNumber(0))
      .multipliedBy(tranchedPoolsBalance)
      .dividedBy(totalBalance)

    estimatedApyFromGfi = seniorPoolPortion.plus(tranchedPoolsPortion)
  }

  const estimatedAnnualGrowthFromGfi = estimatedApyFromGfi
    ? totalBalance.multipliedBy(estimatedApyFromGfi)
    : new BigNumber(0)
  const estimatedAnnualGrowth = estimatedAnnualGrowthFromSupplying.plus(estimatedAnnualGrowthFromGfi)

  const estimatedApy =
    estimatedApyFromSupplying || estimatedApyFromGfi
      ? (estimatedApyFromSupplying || new BigNumber(0)).plus(estimatedApyFromGfi || new BigNumber(0))
      : undefined

  const unrealizedGainsPercent = totalUnrealizedGains.dividedBy(totalBalance)
  const displayUnrealizedGains = roundDownPenny(totalUnrealizedGains)

  return (
    <div className="background-container">
      <div className="background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value" data-testid="portfolio-total-balance">
            {displayDollars(totalBalance)}
          </div>
          <div className="sub-value" data-testid="portfolio-total-balance-perc">
            {displayDollars(displayUnrealizedGains)} ({displayPercent(unrealizedGainsPercent)})
          </div>
        </div>
        <div className="deposit-status-item">
          <div className="deposit-status-item-flex">
            <div className="label">Est. Annual Growth</div>
            <span data-tip="" data-for="annual-growth-tooltip" data-offset="{'top': 0, 'left': 0}" data-place="bottom">
              <InfoIcon />
            </span>
          </div>
          <div className="value" data-testid="portfolio-est-growth">
            {displayDollars(roundDownPenny(estimatedAnnualGrowth))}
          </div>
          <div className="sub-value" data-testid="portfolio-est-growth-perc">{`${displayPercent(estimatedApy)} APY${
            estimatedApyFromGfi && estimatedApyFromGfi.gt(0) ? " (with GFI)" : ""
          }`}</div>
        </div>
      </div>
      <AnnualGrowthTooltipContent
        supplyingCombined={true}
        estimatedApyFromSupplying={estimatedApyFromSupplying}
        estimatedApyFromGfi={estimatedApyFromGfi}
        estimatedApy={estimatedApy}
      />
    </div>
  )
}

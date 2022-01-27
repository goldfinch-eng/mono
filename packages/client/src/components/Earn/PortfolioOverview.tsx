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
      // How much of the principal the user has supplied has earned / is earning GFI rewards at the
      // `tranchedPoolEstimatedApyFromGfi` rate? The definition of this principal amount needs to
      // correspond to / be consistent with how we defined the total amount of (junior) principal
      // dollars in the tranched pool that are earning GFI. The answer is: iterate over the
      // user's pool tokens for a tranched pool, summing (a) if the token corresponds to a closed slice,
      // the token's principal amount minus its redeemed amount minus its redeemable amount; or
      // (b) if the token corresponds to an open slice, the token's principal amount minus its
      // redeemed amount -- but not minus its redeemable amount, because we're assuming the user
      // won't withdraw that withdrawable amount, as that assumption corresponds to our assumption
      // that the pool as a whole fills up.
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

      tranchedPoolsBalanceEarningGfi = tranchedPoolsBalanceEarningGfi.plus(_balanceInDollarsEarningGfi)
      tranchedPoolsGfi.push({
        address: p.tranchedPool.address,
        balanceEarningGfi: _balanceInDollarsEarningGfi,
        estimatedApyFromGfi: tranchedPoolEstimatedApyFromGfi,
      })
    }
  })

  const totalBalance = seniorPoolBalance.plus(tranchedPoolsBalance)
  const estimatedAnnualGrowthFromSupplying = estimatedAnnualGrowthFromSupplyingToSeniorPool.plus(
    estimatedAnnualGrowthFromSupplyingToTranchedPools
  )
  const totalUnrealizedGains = seniorPoolUnrealizedGains.plus(tranchedPoolsUnrealizedGains)

  const estimatedApyFromSupplying = totalBalance.gt(0)
    ? estimatedAnnualGrowthFromSupplying.dividedBy(totalBalance)
    : // TODO[PR] I think we shouldn't show the "global" apy from supplying here.
      // This was reported confusing in manual testing prior to the GFI launch. I also don't
      // think it makes sense to feature the senior pool APY, when there may be backer pools
      // with an APY superior to that. The senior pool APY and backer pool APYs can be seen
      // below on their respective cards.
      undefined

  const seniorPoolBalanceEarningGfi = capitalProvider.value.stakedSeniorPoolBalanceInDollars
  const estimatedApyFromGfiSeniorPool = GFI.estimateApyFromGfi(
    seniorPoolBalanceEarningGfi,
    seniorPoolBalance,
    seniorPoolData.estimatedApyFromGfi
  )

  // Tranched pools' APY-from-GFI is the average of the APY-from-GFI for each tranched pool,
  // weighted by how much the user has supplied (more precisely, how much they've supplied that
  // is earning GFI) to each pool.
  const estimatedApyFromGfiTranchedPools = tranchedPoolsBalanceEarningGfi.gt(0)
    ? tranchedPoolsGfi.reduce<BigNumber>(
        (acc, curr) =>
          acc.plus(
            curr.balanceEarningGfi.multipliedBy(curr.estimatedApyFromGfi).dividedBy(tranchedPoolsBalanceEarningGfi)
          ),
        new BigNumber(0)
      )
    : undefined

  const totalBalanceEarningGfi = seniorPoolBalanceEarningGfi.plus(tranchedPoolsBalanceEarningGfi)

  // Total APY-from-GFI is the average of the senior pool APY-from-GFI and
  // the tranched pools' APY-from-GFI, weighted by how much the user has supplied
  // to the senior pool vs. tranched pools.
  let estimatedApyFromGfi: BigNumber | undefined
  if ((estimatedApyFromGfiSeniorPool || estimatedApyFromGfiTranchedPools) && totalBalanceEarningGfi.gt(0)) {
    const seniorPoolPortion = (estimatedApyFromGfiSeniorPool || new BigNumber(0))
      .multipliedBy(seniorPoolBalanceEarningGfi)
      .dividedBy(totalBalanceEarningGfi)
    const tranchedPoolsPortion = (estimatedApyFromGfiTranchedPools || new BigNumber(0))
      .multipliedBy(tranchedPoolsBalanceEarningGfi)
      .dividedBy(totalBalanceEarningGfi)

    estimatedApyFromGfi = seniorPoolPortion.plus(tranchedPoolsPortion)
  }

  const estimatedAnnualGrowthFromGfi = estimatedApyFromGfi
    ? totalBalanceEarningGfi.multipliedBy(estimatedApyFromGfi)
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

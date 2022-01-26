import BigNumber from "bignumber.js"
import {GFI} from "../../ethereum/gfi"
import {CapitalProvider, PoolData} from "../../ethereum/pool"
import {PoolBacker} from "../../ethereum/tranchedPool"
import {Loaded} from "../../types/loadable"
import {InfoIcon} from "../../ui/icons"
import {displayDollars, displayPercent, roundDownPenny} from "../../utils"
import AnnualGrowthTooltipContent from "../AnnualGrowthTooltipContent"

export function PortfolioOverview({
  poolData,
  capitalProvider,
  poolBackers,
}: {
  poolData: PoolData | undefined
  capitalProvider: Loaded<CapitalProvider>
  poolBackers: Loaded<PoolBacker[]>
}) {
  const loaded = poolData && capitalProvider.loaded && poolBackers.loaded
  if (!loaded) {
    return <></>
  }

  const globalEstimatedApyFromSupplying = poolData.estimatedApy

  let totalBalance = capitalProvider.value.totalSeniorPoolBalanceInDollars
  let totalUnrealizedGains = capitalProvider.value.unrealizedGainsInDollars
  let estimatedAnnualGrowth = totalBalance.multipliedBy(globalEstimatedApyFromSupplying)
  poolBackers.value.forEach((p) => {
    totalBalance = totalBalance.plus(p.balanceInDollars)
    totalUnrealizedGains = totalUnrealizedGains.plus(p.unrealizedGainsInDollars)
    const estimatedJuniorApy = p.tranchedPool.estimateJuniorAPY(p.tranchedPool.estimatedLeverageRatio)
    estimatedAnnualGrowth = estimatedAnnualGrowth.plus(p.balanceInDollars.multipliedBy(estimatedJuniorApy))
  })
  const userEstimatedApyFromSupplying = estimatedAnnualGrowth.dividedBy(totalBalance)
  const estimatedApyFromSupplying = totalBalance.gt(0) ? userEstimatedApyFromSupplying : globalEstimatedApyFromSupplying

  const globalEstimatedApyFromGfi = poolData.estimatedApyFromGfi
  const estimatedApyFromGfi = GFI.estimateApyFromGfi(
    capitalProvider.value.stakedSeniorPoolBalanceInDollars,
    totalBalance,
    globalEstimatedApyFromGfi
  )
  estimatedAnnualGrowth = estimatedAnnualGrowth.plus(
    estimatedApyFromGfi ? totalBalance.multipliedBy(estimatedApyFromGfi) : new BigNumber(0)
  )

  const estimatedApy = estimatedApyFromGfi
    ? estimatedApyFromSupplying.plus(estimatedApyFromGfi)
    : estimatedApyFromSupplying

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

import {GFI} from "../ethereum/gfi"
import {CapitalProvider, SeniorPoolData} from "../ethereum/pool"
import {InfoIcon} from "../ui/icons"
import {displayDollars, displayPercent} from "../utils"
import APYTooltip from "./APYTooltip"

interface DepositStatusProps {
  poolData: SeniorPoolData | undefined
  capitalProvider: CapitalProvider | undefined
}

function DepositStatus(props: DepositStatusProps) {
  if (props.poolData && props.capitalProvider) {
    const portfolioBalance = props.capitalProvider.totalSeniorPoolBalanceInDollars
    const portfolioBalanceDisplay = displayDollars(portfolioBalance)

    const globalEstimatedApyFromSupplying = props.poolData.estimatedApy
    const estimatedApyFromSupplying = globalEstimatedApyFromSupplying

    const globalEstimatedApyFromGfi = props.poolData.estimatedApyFromGfi

    const estimatedApyFromGfi = GFI.estimateApyFromGfi(
      // NOTE: Because our frontend does not currently support staking with lockup, we do not
      // worry here about adjusting for the portion of the user's balance that is not only earning
      // GFI from staking, but is earning that GFI at a boosted rate due to having staked-with-lockup.
      props.capitalProvider.stakedSeniorPoolBalanceInDollars,
      portfolioBalance,
      globalEstimatedApyFromGfi
    )

    const estimatedApy = estimatedApyFromGfi
      ? estimatedApyFromSupplying.plus(estimatedApyFromGfi)
      : estimatedApyFromSupplying
    const apyDisplay = `${displayPercent(estimatedApy)}`

    const estimatedGrowth = portfolioBalance.multipliedBy(estimatedApy)
    const estimatedGrowthDisplay = displayDollars(estimatedGrowth)

    let unrealizedGainsPrefix = props.capitalProvider.unrealizedGainsInDollars.gte(0) ? "+" : ""
    let unrealizedGainsDisplay = displayDollars(props.capitalProvider.unrealizedGainsInDollars)
    let unrealizedGainsPercentDisplay = displayPercent(props.capitalProvider.unrealizedGainsPercentage)

    return (
      <div className="deposit-status background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value" data-testid="portfolio-total-balance">
            {portfolioBalanceDisplay}
          </div>
          <div className="sub-value" data-testid="portfolio-total-balance-perc">
            {unrealizedGainsPrefix}
            {unrealizedGainsDisplay} ({unrealizedGainsPercentDisplay})
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
            {estimatedGrowthDisplay}
          </div>
          <div className="sub-value" data-testid="portfolio-est-growth-perc">{`${apyDisplay} APY${
            estimatedApyFromGfi?.gt(0) ? " (with GFI)" : ""
          }`}</div>
        </div>
        <APYTooltip
          id="annual-growth-tooltip"
          longDescription="Includes the senior pool yield from allocating to borrower pools, plus GFI distributions:"
          rows={[
            {
              text: "Senior Pool APY",
              value: displayPercent(estimatedApyFromSupplying),
            },
            {
              text: "GFI Distribution APY",
              value: displayPercent(estimatedApyFromGfi),
            },
          ]}
          total={{
            text: "Total Est. APY",
            value: displayPercent(estimatedApy),
          }}
        />
      </div>
    )
  } else {
    return (
      <div className="deposit-status background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value" data-testid="portfolio-total-balance">
            {displayDollars(undefined, 2)}
          </div>
        </div>
        <div className="deposit-status-item">
          <div className="label">Est. Annual Growth</div>
          <div className="value" data-testid="portfolio-est-growth">{`${displayDollars(undefined)}`}</div>
        </div>
      </div>
    )
  }
}

export default DepositStatus

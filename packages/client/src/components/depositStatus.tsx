import {BigNumber} from "bignumber.js"
import ReactTooltip from "react-tooltip"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import {InfoIcon} from "../icons"
import {displayDollars, displayPercent} from "../utils"

interface DepositStatusProps {
  poolData?: PoolData
  capitalProvider: CapitalProvider
}

function DepositStatus(props: DepositStatusProps) {
  const portfolioBalance = props.capitalProvider.totalSeniorPoolBalanceInDollars
  const portfolioBalanceDisplay = displayDollars(portfolioBalance)

  let apyDisplay: string, estimatedApy: BigNumber | undefined, estimatedApyFromGfi: BigNumber | undefined
  if (props.poolData?.loaded) {
    const estimatedApyFromSupplying = props.poolData.estimatedApy

    const balancePortionEarningGfi = props.capitalProvider.stakedSeniorPoolBalanceInDollars.div(
      props.capitalProvider.totalSeniorPoolBalanceInDollars
    )
    // NOTE: Because our frontend does not currently support staking with lockup, we do not
    // worry here about adjusting for the portion of the user's balance that is not only earning
    // GFI from staking, but is earning that GFI at a boosted rate due to having staked-with-lockup
    // (which they could have achieved by interacting with the contract directly, rather than using
    // our frontend).
    estimatedApyFromGfi = balancePortionEarningGfi.multipliedBy(props.poolData.estimatedApyFromGfi || new BigNumber(0))

    estimatedApy = estimatedApyFromSupplying.plus(estimatedApyFromGfi)
    apyDisplay = `${displayPercent(estimatedApy)}`
  } else {
    apyDisplay = `${displayPercent(estimatedApy)}`
  }

  if (portfolioBalance.gt(0) && estimatedApy) {
    const estimatedGrowth = portfolioBalance.multipliedBy(estimatedApy)
    const estimatedGrowthDisplay = displayDollars(estimatedGrowth)

    let unrealizedGainsPrefix = props.capitalProvider.unrealizedGainsInDollars.gte(0) ? "+" : ""
    let unrealizedGainsDisplay = displayDollars(props.capitalProvider.unrealizedGainsInDollars)
    let unrealizedGainsPercentDisplay = displayPercent(props.capitalProvider.unrealizedGainsPercentage)

    return (
      <div className="deposit-status background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value">{portfolioBalanceDisplay}</div>
          <div className="sub-value">
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
          <div className="value">{estimatedGrowthDisplay}</div>
          <div className="sub-value">{`${apyDisplay} APY${estimatedApyFromGfi?.gt(0) ? " (with GFI)" : ""}`}</div>
        </div>
        <ReactTooltip
          className="goldfinch-tooltip"
          id="annual-growth-tooltip"
          effect="solid"
          arrowColor="transparent"
          delayShow={200}
        >
          <div>
            <p className="tooltip-description">
              Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:
            </p>
            <div className="tooltip-row">
              <p>Senior Pool APY</p>
              <span>--.--%</span>
            </div>
            <div className="tooltip-row">
              <p>GFI Rewards APY</p>
              <span>--.--%</span>
            </div>
            <div className="tooltip-divider"></div>
            <div className="tooltip-row">
              <p>Total Est. APY</p>
              <span>--.--%</span>
            </div>
          </div>
        </ReactTooltip>
      </div>
    )
  } else {
    return (
      <div className="deposit-status background-container-inner">
        <div className="deposit-status-item">
          <div className="label">Portfolio balance</div>
          <div className="value">{portfolioBalanceDisplay}</div>
        </div>
        <div className="deposit-status-item">
          <div className="label">Est. APY</div>
          <div className="value">{apyDisplay}</div>
        </div>
      </div>
    )
  }
}

export default DepositStatus

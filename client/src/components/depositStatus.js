import React from "react"
import { displayDollars, displayPercent } from "../utils"

function DepositStatus(props) {
  const portfolioBalance = props.capitalProvider.availableToWithdrawalInDollars
  const portfolioBalanceDisplay = displayDollars(portfolioBalance)
  const estimatedTotalInterest = props.creditDesk.gf && props.creditDesk.gf.estimatedTotalInterest

  let apyDisplay, estimatedAPY
  if (estimatedTotalInterest && props.poolData.loaded) {
    estimatedAPY = props.creditDesk.gf.estimatedTotalInterest.dividedBy(props.poolData.totalPoolAssets)
    apyDisplay = `${displayPercent(estimatedAPY)}`
  } else {
    estimatedAPY = NaN
    apyDisplay = `${displayPercent(estimatedAPY)}`
  }

  if (portfolioBalance > 0 && estimatedAPY) {
    const estimatedGrowth = estimatedAPY.multipliedBy(portfolioBalance)
    const estimatedGrowthDisplay = displayDollars(estimatedGrowth)

    let unrealizedGainsPrefix = props.capitalProvider.unrealizedGainsInDollars >= 0 ? "+" : ""
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
          <div className="label">Est. Annual Growth</div>
          <div className="value">{estimatedGrowthDisplay}</div>
          <div className="sub-value">{`${apyDisplay} APY`}</div>
        </div>
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

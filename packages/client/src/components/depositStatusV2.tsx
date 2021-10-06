import {BigNumber} from "bignumber.js"
import {SeniorPoolData, UserData} from "../graphql/helpers"
import {displayDollars, displayPercent} from "../utils"

interface DepositStatusProps {
  poolData: SeniorPoolData
  capitalProvider?: UserData
}

function DepositStatus(props: DepositStatusProps) {
  const {capitalProvider, poolData} = props
  const portfolioBalance = capitalProvider?.availableToWithdrawInDollars
  const portfolioBalanceDisplay = displayDollars(portfolioBalance)

  let apyDisplay: string, estimatedAPY: BigNumber | null
  if (poolData) {
    estimatedAPY = poolData.estimatedApy
    apyDisplay = `${displayPercent(estimatedAPY)}`
  } else {
    estimatedAPY = null
    apyDisplay = `${displayPercent(estimatedAPY)}`
  }

  if (portfolioBalance && portfolioBalance.gt(0) && estimatedAPY) {
    const estimatedGrowth = estimatedAPY.multipliedBy(portfolioBalance)
    const estimatedGrowthDisplay = displayDollars(estimatedGrowth)

    let unrealizedGainsPrefix = capitalProvider?.unrealizedGainsInDollars.gte(0) ? "+" : ""
    let unrealizedGainsDisplay = displayDollars(capitalProvider?.unrealizedGainsInDollars)
    let unrealizedGainsPercentDisplay = displayPercent(capitalProvider?.unrealizedGainsPercentage)

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

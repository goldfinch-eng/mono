import {BigNumber} from "bignumber.js"
import {SeniorPool, User} from "../graphql/types"
import {displayDollars, displayPercent} from "../utils"

interface DepositStatusProps {
  poolData?: SeniorPool
  capitalProvider: User
}

function DepositStatus(props: DepositStatusProps) {
  const portfolioBalance = props.capitalProvider?.capitalProviderStatus?.availableToWithdrawInDollars
  const portfolioBalanceDisplay = displayDollars(portfolioBalance)

  let apyDisplay: string, estimatedAPY: BigNumber | null
  if (props.poolData) {
    estimatedAPY = props.poolData.lastestPoolStatus?.estimatedApy
    apyDisplay = `${displayPercent(estimatedAPY)}`
  } else {
    estimatedAPY = null
    apyDisplay = `${displayPercent(estimatedAPY)}`
  }

  if (portfolioBalance?.gt(0) && estimatedAPY) {
    const estimatedGrowth = estimatedAPY.multipliedBy(portfolioBalance)
    const estimatedGrowthDisplay = displayDollars(estimatedGrowth)

    let unrealizedGainsPrefix = props.capitalProvider?.capitalProviderStatus?.unrealizedGainsInDollars.gte(0) ? "+" : ""
    let unrealizedGainsDisplay = displayDollars(props.capitalProvider?.capitalProviderStatus?.unrealizedGainsInDollars)
    let unrealizedGainsPercentDisplay = displayPercent(
      props.capitalProvider?.capitalProviderStatus?.unrealizedGainsPercentage,
    )

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

import {BigNumber} from "bignumber.js"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import {isGraphSeniorPoolData, GraphSeniorPoolData, GraphUserData} from "../graphql/utils"
import {displayDollars, displayPercent} from "../utils"

interface DepositStatusProps {
  poolData?: PoolData | GraphSeniorPoolData
  capitalProvider?: CapitalProvider | GraphUserData
}

function DepositStatus(props: DepositStatusProps) {
  const {capitalProvider, poolData} = props
  const portfolioBalance = capitalProvider?.availableToWithdrawInDollars || new BigNumber("0")
  const portfolioBalanceDisplay = displayDollars(portfolioBalance)

  let estimatedAPY: BigNumber | null = null

  if (isGraphSeniorPoolData(poolData) || poolData?.loaded) {
    estimatedAPY = poolData.estimatedApy
  }
  let apyDisplay: string = `${displayPercent(estimatedAPY)}`

  if (portfolioBalance.gt(0) && estimatedAPY) {
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

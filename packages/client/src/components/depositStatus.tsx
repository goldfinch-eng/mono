import {BigNumber} from "bignumber.js"
import {CapitalProvider, PoolData} from "../ethereum/pool"
import {displayDollars, displayPercent} from "../utils"

interface DepositStatusProps {
  poolData?: PoolData
  capitalProvider: CapitalProvider
}

function DepositStatus(props: DepositStatusProps) {
  const portfolioBalance = props.capitalProvider.availableToWithdrawInDollars
  const portfolioBalanceDisplay = displayDollars(portfolioBalance)

  let apyDisplay: string, estimatedAPY: BigNumber | null
  if (props.poolData?.loaded) {
    estimatedAPY = props.poolData.estimatedApy.plus(
      // NOTE: Because the UI does not currently support staking with lockup, we do not
      // worry about adjusting `estimatedApyFromGfi` here by the appropriate multiplier
      // to reflect the boosted rewards APY the user may in fact be receiving (i.e. would
      // be receiving if they have staked-with-lockup e.g. by interacting with the contract
      // directly).
      props.poolData.estimatedApyFromGfi || new BigNumber(0)
    )
    apyDisplay = `${displayPercent(estimatedAPY)}`
  } else {
    estimatedAPY = null
    apyDisplay = `${displayPercent(estimatedAPY)}`
  }

  if (portfolioBalance.gt(0) && estimatedAPY) {
    const estimatedGrowth = estimatedAPY.multipliedBy(portfolioBalance)
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
          <div className="label">Est. Annual Growth</div>
          <div className="value">{estimatedGrowthDisplay}</div>
          <div className="sub-value">{`${apyDisplay} APY${
            props.poolData?.estimatedApyFromGfi ? " (with GFI)" : ""
          }`}</div>
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

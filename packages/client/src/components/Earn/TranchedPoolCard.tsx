import BigNumber from "bignumber.js"
import {useHistory} from "react-router-dom"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {displayDollars, displayPercent} from "../../utils"
import Badge from "../badge"

export default function TranchedPoolCard({
  poolBacker,
  poolEstimatedBackersOnlyApyFromGfi,
  poolEstimatedSeniorPoolMatchingApyFromGfi,
  disabled,
}: {
  poolBacker: TranchedPoolBacker
  poolEstimatedBackersOnlyApyFromGfi: BigNumber | undefined
  poolEstimatedSeniorPoolMatchingApyFromGfi: BigNumber | undefined
  disabled: boolean
}) {
  const history = useHistory()
  const tranchedPool = poolBacker.tranchedPool
  const leverageRatio = tranchedPool.estimatedLeverageRatio
  const limit = usdcFromAtomic(tranchedPool.creditLine.limit)

  const estimatedApyFromSupplying = leverageRatio ? tranchedPool.estimateJuniorAPY(leverageRatio) : undefined
  const estimatedApy =
    estimatedApyFromSupplying || poolEstimatedBackersOnlyApyFromGfi || poolEstimatedSeniorPoolMatchingApyFromGfi
      ? (estimatedApyFromSupplying || new BigNumber(0))
          .plus(poolEstimatedBackersOnlyApyFromGfi || new BigNumber(0))
          .plus(poolEstimatedSeniorPoolMatchingApyFromGfi || new BigNumber(0))
      : new BigNumber(NaN)

  const disabledClass = disabled ? "disabled" : ""
  const balanceDisabledClass = poolBacker?.tokenInfos.length === 0 ? "disabled" : ""
  const getBadge = () => {
    if (tranchedPool.isPaused) {
      return <Badge text="Paused" variant="gray" fixedWidth={false} />
    } else if (tranchedPool.isRepaid) {
      return <Badge text="Repaid" variant="green" fixedWidth={false} />
    } else if (tranchedPool.isFull) {
      return <Badge text="Full" variant="gray" fixedWidth={true} />
    } else {
      return <Badge text="Open" variant="blue" fixedWidth={true} />
    }
  }
  const badge = getBadge()

  return (
    <div
      className="table-row background-container-inner clickable pool-card"
      onClick={() => history.push(`/pools/${tranchedPool.address}`)}
    >
      <div className={`table-cell col40 pool-info ${disabledClass}`}>
        <img className={`icon ${disabledClass}`} src={tranchedPool.metadata?.icon} alt="pool-icon" />
        <div className="name">
          <span>{tranchedPool.displayName}</span>
          <span className={`subheader ${disabledClass}`}>{tranchedPool.metadata?.category}</span>
        </div>
      </div>
      <div className={`${balanceDisabledClass} ${disabledClass} table-cell col22 numeric balance`}>
        {poolBacker.address ? displayDollars(poolBacker?.balanceInDollars) : displayDollars(undefined)}
      </div>
      <div className={`table-cell col22 numeric limit ${disabledClass}`}>{displayDollars(limit, 0)}</div>
      <div className={`table-cell col16 numeric apy ${disabledClass}`}>{displayPercent(estimatedApy)}</div>
      <div className="pool-capacity">{badge}</div>
    </div>
  )
}

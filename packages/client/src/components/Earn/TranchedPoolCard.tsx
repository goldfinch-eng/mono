import BigNumber from "bignumber.js"
import {useHistory} from "react-router-dom"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {PoolBacker} from "../../ethereum/tranchedPool"
import {InfoIcon} from "../../ui/icons"
import {displayDollars, displayPercent} from "../../utils"
import Badge from "../badge"

export default function TranchedPoolCard({poolBacker, disabled}: {poolBacker: PoolBacker; disabled: boolean}) {
  const history = useHistory()
  const tranchedPool = poolBacker.tranchedPool
  const leverageRatio = tranchedPool.estimatedLeverageRatio
  const limit = usdcFromAtomic(tranchedPool.creditLine.limit)

  const estimatedApy = leverageRatio ? tranchedPool.estimateJuniorAPY(leverageRatio) : new BigNumber(NaN)
  const estimatedApyFromGfi = undefined

  const disabledClass = disabled ? "disabled" : ""
  const balanceDisabledClass = poolBacker?.tokenInfos.length === 0 ? "disabled" : ""
  const badge = tranchedPool.isPaused ? (
    <Badge text="Paused" variant="gray" fixedWidth={false} />
  ) : tranchedPool.isFull ? (
    <Badge text="Full" variant="gray" fixedWidth={true} />
  ) : (
    <Badge text="Open" variant="blue" fixedWidth={true} />
  )

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
      <div className={`table-cell col22 numeric apy ${disabledClass}`}>
        <div className="usdc-apy">{displayPercent(estimatedApy)} USDC</div>
        <div className="gfi-apy">
          {displayPercent(estimatedApyFromGfi)} with GFI
          <span data-tip="" data-for="" data-offset="{'top': 0, 'left': 0}" data-place="bottom">
            <InfoIcon />
          </span>
        </div>
      </div>
      <div className={`table-cell col22 numeric limit ${disabledClass}`}>{displayDollars(limit, 0)}</div>
      <div className={`${balanceDisabledClass} ${disabledClass} table-cell col22 numeric balance`}>
        {poolBacker.address ? displayDollars(poolBacker?.balanceInDollars) : displayDollars(undefined)}
      </div>
      <div className="pool-capacity">{badge}</div>
    </div>
  )
}

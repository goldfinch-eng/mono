import BigNumber from "bignumber.js"
import {useHistory} from "react-router-dom"
import {useContext} from "react"
import {AppContext} from "../../App"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {InfoIcon} from "../../ui/icons"
import {displayDollars, displayPercent} from "../../utils"
import Badge from "../badge"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../styleConstants"
import APYTooltip from "../APYTooltip"

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
  const {currentBlock} = useContext(AppContext)
  const history = useHistory()
  const isMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })
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

  const currentTimestamp = currentBlock?.timestamp
  const isCurrentTimeBeforePoolFundableAt =
    currentTimestamp && new BigNumber(currentTimestamp) < tranchedPool.fundableAt

  const disabledClass = disabled ? "disabled" : ""
  const balanceDisabledClass = poolBacker?.getAllTokenInfos().length === 0 ? "disabled" : ""
  const getBadge = () => {
    if (tranchedPool.isPaused) {
      return <Badge text="Paused" variant="gray" fixedWidth={false} />
    } else if (tranchedPool.isRepaid) {
      return <Badge text="Repaid" variant="green" fixedWidth={false} />
    } else if (tranchedPool.isFull) {
      return <Badge text="Full" variant="gray" fixedWidth={true} />
    } else if (tranchedPool.creditLine.termEndTime.isZero() && isCurrentTimeBeforePoolFundableAt) {
      return <Badge text="Coming Soon" variant="yellow" fixedWidth={false} />
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
      <div className={`table-cell col32 numeric apy ${disabledClass}`}>
        <div className="usdc-apy">{displayPercent(estimatedApyFromSupplying)} USDC</div>
        <div className="gfi-apy">
          {displayPercent(estimatedApy)} with GFI
          <span
            data-tip=""
            data-for={`apy-tooltip-${tranchedPool.address}`}
            data-offset={`{'top': 0, 'left': ${isMobile ? 150 : 0}}`}
            data-place="bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <InfoIcon />
          </span>
        </div>
      </div>
      <div className={`table-cell col22 numeric limit ${disabledClass}`}>{displayDollars(limit, 0)}</div>
      <div className={`${balanceDisabledClass} ${disabledClass} table-cell col22 numeric balance`}>
        {poolBacker.address ? displayDollars(poolBacker?.balanceInDollars) : displayDollars(undefined)}
      </div>
      <div className="pool-capacity">{badge}</div>
      <APYTooltip
        classNames="apy-detail-tooltip clickable"
        id={`apy-tooltip-${tranchedPool.address}`}
        longDescription="Includes the base USDC interest yield plus GFI from both liquidity mining and staking."
        rows={[
          {
            text: "Base interest USDC APY",
            value: displayPercent(estimatedApyFromSupplying),
          },
          {
            text: "Backer liquidity mining GFI APY",
            value: poolEstimatedBackersOnlyApyFromGfi
              ? `~${displayPercent(poolEstimatedBackersOnlyApyFromGfi)}`
              : displayPercent(poolEstimatedBackersOnlyApyFromGfi),
          },
          {
            text: "LP rewards match GFI APY",
            value: poolEstimatedSeniorPoolMatchingApyFromGfi
              ? `~${displayPercent(poolEstimatedSeniorPoolMatchingApyFromGfi)}`
              : displayPercent(poolEstimatedSeniorPoolMatchingApyFromGfi),
          },
        ]}
        total={{
          text: "Total Est. APY",
          value:
            estimatedApy && (poolEstimatedBackersOnlyApyFromGfi || poolEstimatedSeniorPoolMatchingApyFromGfi)
              ? `~${displayPercent(estimatedApy)}`
              : displayPercent(estimatedApy),
        }}
      />
    </div>
  )
}

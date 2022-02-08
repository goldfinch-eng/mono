import {useHistory} from "react-router-dom"
import BigNumber from "bignumber.js"
import Badge from "../badge"
import logoPurp from "../../images/logomark-purp.svg"
import {InfoIcon} from "../../ui/icons"
import {displayPercent} from "../../utils"
import EarnTooltipContent from "./EarnTooltipContent"

type SeniorPoolCardProps = {
  balance: string
  userBalance: string
  estimatedApyFromSupplying: BigNumber | undefined
  estimatedApyFromGfi: BigNumber | undefined
  estimatedApy: BigNumber | undefined
  limit: string
  remainingCapacity: BigNumber | undefined
  disabled: boolean
  userBalanceDisabled: boolean
}

export default function SeniorPoolCard(props: SeniorPoolCardProps) {
  const disabledClass = props.disabled ? "disabled" : ""
  const userBalanceDisabledClass = props.userBalanceDisabled ? "disabled" : ""
  const history = useHistory()
  return (
    <div
      key="senior-pool"
      className={`table-row background-container-inner clickable pool-card ${disabledClass}`}
      onClick={() => history.push("/pools/senior")}
    >
      <div className="table-cell col40 pool-info">
        <div>
          <img className={`senior-pool-icon icon ${disabledClass}`} src={logoPurp} alt="Senior Pool icon" />
        </div>
        <div>
          <span className="name">Goldfinch Senior Pool</span>
          <span className={`subheader ${disabledClass}`}>Automated diversified portfolio</span>
        </div>
      </div>
      <div className="table-cell col32 numeric apy">
        <div className="usdc-apy">{displayPercent(props.estimatedApyFromSupplying)} USDC</div>
        <div className="gfi-apy">
          {displayPercent(props.estimatedApy)} with GFI
          <span
            data-tip=""
            data-for="senior-pool-card-tooltip"
            data-offset="{'top': 0, 'left': 0}"
            data-place="bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <InfoIcon />
          </span>
        </div>
      </div>
      <div className="table-cell col22 numeric limit senior-pool-limit">Unlimited</div>
      <div className={`table-cell col22 numeric balance ${userBalanceDisabledClass}`}>{props.userBalance}</div>
      <div className="pool-capacity">
        {props.remainingCapacity?.isZero() ? (
          <Badge text="Full" variant="gray" fixedWidth />
        ) : (
          <Badge text="Open" variant="blue" fixedWidth />
        )}
      </div>
      <EarnTooltipContent
        longDescription="Includes the Senior pool yield from allocating to borrower pools, plus GFI distributions."
        rows={[
          {
            text: "Senior Pool APY",
            value: displayPercent(props.estimatedApyFromSupplying),
          },
          {
            text: "GFI Distribution APY",
            value: displayPercent(props.estimatedApyFromGfi),
          },
        ]}
        total={{
          text: "Total Est. APY",
          value: displayPercent(props.estimatedApy),
        }}
      />
    </div>
  )
}

import {useHistory} from "react-router-dom"
import BigNumber from "bignumber.js"
import Badge from "../badge"
import logoPurp from "../../images/logomark-purp.svg"
import {InfoIcon} from "../../ui/icons"
import SeniorPoolCardTooltipContent from "./SeniorPoolCardTooltipContent"
import {displayPercent} from "../../utils"

type SeniorPoolCardProps = {
  balance: string
  userBalance: string
  estimatedApy: BigNumber | undefined
  estimatedApyFromGfi: BigNumber | undefined
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
      <div className="table-cell col22 numeric apy">
        <div className="usdc-apy">{displayPercent(props.estimatedApy)} USDC</div>
        <div className="gfi-apy">
          {displayPercent(props.estimatedApyFromGfi)} with GFI
          <span data-tip="" data-for="senior-pool-card-tooltip" data-offset="{'top': 0, 'left': 0}" data-place="bottom">
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
      <SeniorPoolCardTooltipContent estimatedApy={props.estimatedApy} estimatedApyFromGfi={props.estimatedApyFromGfi} />
    </div>
  )
}

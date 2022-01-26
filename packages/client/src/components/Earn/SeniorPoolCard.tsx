import {useHistory} from "react-router-dom"
import Badge from "../badge"
import {SeniorPoolCardProps} from "./types"

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
      <div className="table-cell col40">
        {props.balance}
        <span className={`subheader ${disabledClass}`}>Total Pool Balance</span>
      </div>
      <div className={`table-cell col22 numeric balance ${userBalanceDisabledClass}`}>{props.userBalance}</div>
      <div className="table-cell col22 numeric limit">{props.limit}</div>
      <div className="table-cell col16 numeric apy">{props.apy}</div>
      <div className="pool-capacity">
        {props.remainingCapacity?.isZero() ? (
          <Badge text="Full" variant="gray" fixedWidth />
        ) : (
          <Badge text="Open" variant="blue" fixedWidth />
        )}
      </div>
    </div>
  )
}

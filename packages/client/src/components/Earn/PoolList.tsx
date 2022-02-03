import {InfoIcon} from "../../ui/icons"

export default function PoolList({title, subtitle, children}) {
  return (
    <div className="pools-list table-spaced background-container">
      <div className="title">{title}</div>
      <div className="subtitle">{subtitle}</div>
      <div className="table-header background-container-inner">
        <div className="table-cell col40">Pool</div>
        <div className="table-cell col16 numeric apy apy-column-name">
          Est. APY
          <span
            className="tooltip-icon"
            data-tip=""
            data-for=""
            data-offset="{'top': 0, 'left': 0}"
            data-place="bottom"
          >
            <InfoIcon />
          </span>
        </div>

        <div className="table-cell col22 numeric limit">Pool Limit</div>
        <div className="table-cell col22 numeric balance">Your Balance</div>
      </div>
      {children}
    </div>
  )
}

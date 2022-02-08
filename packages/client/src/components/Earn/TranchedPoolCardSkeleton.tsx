import {InfoIcon} from "../../ui/icons"

export default function TranchedPoolCardSkeleton() {
  return (
    <div className="table-row background-container-inner clickable pool-skeleton">
      <div className="table-cell col40 pool-info fallback-content">
        <div className="circle-icon" />
        <div className="name">
          <span>Loading...</span>
        </div>
      </div>
      <div className="disabled table-cell col22 numeric apy">
        <div className="usdc-apy">--.--% USDC</div>
        <div className="gfi-apy">
          --.--% with GFI
          <span data-tip="" data-for="" data-offset="{'top': 0, 'left': 0}" data-place="bottom">
            <InfoIcon />
          </span>
        </div>
      </div>
      <div className="disabled table-cell col22 numeric limit">$--.--</div>
      <div className="disabled table-cell col22 numeric balance">$--.--</div>
    </div>
  )
}

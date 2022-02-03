import {InfoIcon} from "../../ui/icons"

export default function SeniorPoolCardSkeleton() {
  return (
    <div key="senior-pool" className="table-row background-container-inner clickable pool-skeleton">
      <div className="table-cell col40 pool-info fallback-content">
        <div className="circle-icon" />
        <div className="name">
          <span>Loading...</span>
        </div>
      </div>
      <div className="table-cell col22 numeric apy disabled">
        <div className="usdc-apy">--.--% USDC</div>
        <div className="gfi-apy">
          --.--% with GFI
          <span data-tip="" data-for="" data-offset="{'top': 0, 'left': 0}" data-place="bottom">
            <InfoIcon />
          </span>
        </div>
      </div>
      <div className="table-cell col22 numeric limit disabled">$--.--</div>
      <div className="table-cell col22 numeric balance disabled">$--.--</div>
    </div>
  )
}

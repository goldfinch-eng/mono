import BigNumber from "bignumber.js"
import Tooltip from "../ui/components/Tooltip"
import {displayPercent} from "../utils"

type AnnualGrowthTooltipContentProps = {
  estimatedApyFromSupplying: BigNumber
  estimatedApyFromGfi: BigNumber
}

const AnnualGrowthTooltipContent = ({
  estimatedApyFromSupplying,
  estimatedApyFromGfi,
}: AnnualGrowthTooltipContentProps) => (
  <Tooltip id="annual-growth-tooltip" className="annual-growth-tooltip">
    <div>
      <p className="tooltip-description">
        Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:
      </p>
      <div className="tooltip-row">
        <p>Senior Pool APY</p>
        <span>{displayPercent(estimatedApyFromSupplying)}</span>
      </div>
      <div className="tooltip-row">
        <p>GFI Rewards APY</p>
        <span>{displayPercent(estimatedApyFromGfi)}</span>
      </div>
      <div className="tooltip-divider"></div>
      <div className="tooltip-row">
        <p>Total Est. APY</p>
        <span>{displayPercent(estimatedApyFromSupplying.plus(estimatedApyFromGfi))}</span>
      </div>
    </div>
  </Tooltip>
)

export default AnnualGrowthTooltipContent

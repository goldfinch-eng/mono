import BigNumber from "bignumber.js"
import Tooltip from "../ui/components/Tooltip"
import {displayPercent} from "../utils"

type AnnualGrowthTooltipContentProps = {
  supplyingCombined: boolean
  estimatedApyFromSupplying: BigNumber
  estimatedApyFromGfi: BigNumber
  estimatedApy: BigNumber
}

const AnnualGrowthTooltipContent = ({
  supplyingCombined,
  estimatedApyFromSupplying,
  estimatedApyFromGfi,
  estimatedApy,
}: AnnualGrowthTooltipContentProps) => (
  <Tooltip id="annual-growth-tooltip" className="annual-growth-tooltip">
    <div>
      <p className="tooltip-description">
        {supplyingCombined
          ? "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
          : "Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:"}
      </p>
      <div className="tooltip-row">
        <p>{supplyingCombined ? "Pool APY" : "Senior Pool APY"}</p>
        <span>{displayPercent(estimatedApyFromSupplying)}</span>
      </div>
      <div className="tooltip-row">
        <p>GFI Rewards APY</p>
        <span>{displayPercent(estimatedApyFromGfi)}</span>
      </div>
      <div className="tooltip-divider"></div>
      <div className="tooltip-row">
        <p>Total Est. APY</p>
        <span>{displayPercent(estimatedApy)}</span>
      </div>
    </div>
  </Tooltip>
)

export default AnnualGrowthTooltipContent

import BigNumber from "bignumber.js"
import Tooltip from "../ui/components/Tooltip"
import {displayPercent} from "../utils"

type AnnualGrowthTooltipContentProps = {
  supplyingCombined: boolean
  estimatedApyFromSupplying: BigNumber | undefined
  estimatedApyFromGfi: BigNumber | undefined
  estimatedApy: BigNumber | undefined
}

const AnnualGrowthTooltipContent = ({
  supplyingCombined,
  estimatedApyFromSupplying,
  estimatedApyFromGfi,
  estimatedApy,
}: AnnualGrowthTooltipContentProps) => (
  <Tooltip id="annual-growth-tooltip" className="tooltip-container">
    <div>
      <p className="tooltip-description">
        {supplyingCombined
          ? "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI distributions:"
          : "Includes the senior pool yield from allocating to borrower pools, plus GFI distributions:"}
      </p>
      <div className="tooltip-row">
        <p>{supplyingCombined ? "Pools APY" : "Senior Pool APY"}</p>
        <span data-testid="tooltip-estimated-apy">{displayPercent(estimatedApyFromSupplying)}</span>
      </div>
      <div className="tooltip-row">
        <p>GFI Distribution APY</p>
        <span data-testid="tooltip-gfi-apy">{displayPercent(estimatedApyFromGfi)}</span>
      </div>
      <div className="tooltip-divider"></div>
      <div className="tooltip-row">
        <p>Total Est. APY</p>
        <span data-testid="tooltip-total-apy">{displayPercent(estimatedApy)}</span>
      </div>
    </div>
  </Tooltip>
)

export default AnnualGrowthTooltipContent

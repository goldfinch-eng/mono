import BigNumber from "bignumber.js"
import Tooltip from "../../ui/components/Tooltip"
import {displayPercent} from "../../utils"

type SeniorPoolCardTooltipContentProps = {
  estimatedApyFromSupplying: BigNumber | undefined
  estimatedApyFromGfi: BigNumber | undefined
  estimatedApy: BigNumber | undefined
}

const SeniorPoolCardTooltipContent = ({
  estimatedApyFromSupplying,
  estimatedApyFromGfi,
  estimatedApy,
}: SeniorPoolCardTooltipContentProps) => (
  <Tooltip id="senior-pool-card-tooltip" className="senior-pool-card-tooltip">
    <div>
      <p className="tooltip-description">
        Includes the Senior pool yield from allocating to borrower pools, plus GFI distributions.
      </p>
      <div className="tooltip-row">
        <p>Senior Pool APY</p>
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

export default SeniorPoolCardTooltipContent

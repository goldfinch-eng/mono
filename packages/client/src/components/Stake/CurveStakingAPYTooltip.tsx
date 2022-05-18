import {useMediaQuery} from "react-responsive"
import styled from "styled-components"
import Tooltip from "../../ui/components/Tooltip"
import {WIDTH_TYPES} from "../styleConstants"

const StyledTooltip = styled(Tooltip)`
  max-width: 300px;
`

export default function CurveStakingAPYTooltip() {
  const isTabletOrMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })

  return (
    <StyledTooltip
      id="curve-apy-tooltip"
      delayHide={isTabletOrMobile ? 50 : 400}
      className="tooltip-container"
      place="left"
    >
      <div>
        <p>
          GFI reward APY for the FIDU portion of a Curve LP position. The USDC portion does not receive GFI rewards. The
          entire Curve LP position accrues swap fees.
        </p>
      </div>
    </StyledTooltip>
  )
}

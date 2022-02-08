import BigNumber from "bignumber.js"
import {useMediaQuery} from "react-responsive"
import Tooltip from "../../ui/components/Tooltip"
import {displayPercent} from "../../utils"
import {WIDTH_TYPES} from "../styleConstants"

type TranchedPoolCardTooltipContentProps = {
  estimatedUSDCApy: BigNumber | undefined
  estimatedBackersOnlyApy: BigNumber | undefined
  estimatedLpSeniorPoolMatchingApy: BigNumber | undefined
  estimatedApy: BigNumber | undefined
  tranchedPoolAddress: string
}

const TranchedPoolCardTooltipContent = ({
  estimatedUSDCApy,
  estimatedBackersOnlyApy,
  estimatedLpSeniorPoolMatchingApy,
  estimatedApy,
  tranchedPoolAddress,
}: TranchedPoolCardTooltipContentProps) => {
  const isTabletOrMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })

  return (
    <Tooltip
      id={`tranched-pool-card-tooltip-${tranchedPoolAddress}`}
      delayHide={isTabletOrMobile ? 50 : 400}
      className="tranched-pool-card-tooltip clickable"
      place="left"
    >
      <div onClick={(e) => e.stopPropagation()}>
        <p className="tooltip-description">
          Includes the base USDC interest yield plus GFI from both liquidity mining and staking.
        </p>
        <div className="tooltip-row">
          <p>Base interest USDC APY</p>
          <span>{displayPercent(estimatedUSDCApy)}</span>
        </div>
        <div className="tooltip-row">
          <p>Backer liquidity mining GFI APY*</p>
          <span data-testid="tooltip-gfi-apy">
            {estimatedBackersOnlyApy
              ? `~${displayPercent(estimatedBackersOnlyApy)}`
              : displayPercent(estimatedBackersOnlyApy)}
          </span>
        </div>
        <div className="tooltip-row">
          <p>LP rewards match GFI APY*</p>
          <span>
            {estimatedLpSeniorPoolMatchingApy
              ? `~${displayPercent(estimatedLpSeniorPoolMatchingApy)}`
              : displayPercent(estimatedLpSeniorPoolMatchingApy)}
          </span>
        </div>
        <div className="tooltip-small-row">(expected to launch in March)</div>
        <div className="tooltip-divider"></div>
        <div className="tooltip-row">
          <p>Total Est. APY</p>
          <span>
            {estimatedApy && (estimatedBackersOnlyApy || estimatedLpSeniorPoolMatchingApy)
              ? `~${displayPercent(estimatedApy)}`
              : displayPercent(estimatedApy)}
          </span>
        </div>
        <div className="tooltip-footer">
          <p>
            *Learn more in the proposals for{" "}
            <a
              href="https://snapshot.org/#/goldfinch.eth/proposal/0x10a390307e3834af5153dc58af0e20cbb0e08d38543be884b622b55bfcd5818d"
              target="_blank"
              rel="noreferrer"
            >
              Backer liquidity mining
            </a>{" "}
            and{" "}
            <a
              href="https://snapshot.org/#/goldfinch.eth/proposal/0x10a390307e3834af5153dc58af0e20cbb0e08d38543be884b622b55bfcd5818d"
              target="_blank"
              rel="noreferrer"
            >
              staking distributions
            </a>
            .
          </p>
        </div>
      </div>
    </Tooltip>
  )
}

export default TranchedPoolCardTooltipContent

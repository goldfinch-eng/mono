import BigNumber from "bignumber.js"
import Tooltip from "../ui/components/Tooltip"
import {displayPercent} from "../utils"

type TranchedPoolApyTooltipContentProps = {
  estimatedUSDCApy: BigNumber | undefined
  estimatedBackersOnlyApy: BigNumber | undefined
  estimatedLpSeniorPoolMatchingApy: BigNumber | undefined
  estimatedApy: BigNumber | undefined
}

const TranchedPoolApyTooltipContent = ({
  estimatedUSDCApy,
  estimatedBackersOnlyApy,
  estimatedLpSeniorPoolMatchingApy,
  estimatedApy,
}: TranchedPoolApyTooltipContentProps) => (
  <Tooltip id="tranched-pool-apy-tooltip" delayHide={400} className="tranched-pool-detail-tooltip clickable">
    <div>
      <p className="tooltip-long-description">
        Includes the base USDC interest yield plus GFI from both liquidity mining and staking.
      </p>
      <div className="tooltip-row">
        <p>Base interest USDC APY</p>
        <span>{displayPercent(estimatedUSDCApy)}</span>
      </div>
      <div className="tooltip-row">
        <p>Backer liquidity mining GFI APY*</p>
        <span>
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
            href="https://snapshot.org/#/goldfinch.eth/proposal/0xb716c18c38eb1828044aca84a1466ac08221a37a96ce73b04e9caa847e13e0da"
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

export default TranchedPoolApyTooltipContent

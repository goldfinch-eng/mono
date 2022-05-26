import {assertUnreachable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {StakedPositionType} from "../ethereum/pool"
import {displayPercent} from "../utils"
import {iconOutArrow} from "./icons"

type StakingPromptProps = {
  className?: string
  stakedPositionType: StakedPositionType
  stakingApy?: BigNumber
  onToggle: (boolean) => any
  formVal?: string
}

export default function StakingPrompt({
  className,
  stakedPositionType,
  stakingApy,
  onToggle,
  formVal: _formVal,
}: StakingPromptProps) {
  const formVal = _formVal || "staking"

  function onChange(e) {
    onToggle(e.currentTarget.checked)
  }

  const tokenName = (() => {
    switch (stakedPositionType) {
      case StakedPositionType.Fidu:
        return "FIDU"
      case StakedPositionType.CurveLP:
        return "Curve LP tokens"
      default:
        assertUnreachable(stakedPositionType)
    }
  })()

  return (
    <div className={`checkbox-container form-input-label ${className}`}>
      <input
        className="checkbox"
        type="checkbox"
        data-testid="staking"
        name={formVal}
        id={formVal}
        defaultChecked
        onChange={onChange}
      />
      <label className="checkbox-label with-note" htmlFor={formVal}>
        <div>
          <div className="checkbox-label-primary">
            <div>{`I want to stake my ${tokenName} to earn GFI rewards (additional ${displayPercent(
              stakingApy
            )} APY).`}</div>
          </div>
          <div className="form-input-note">
            <p>
              Staking incurs an additional gas fee. Because Goldfinch incentivizes long-term participation, you will
              receive maximum GFI rewards by staking for at least 12 months.{" "}
              <a
                href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/senior-pool-liquidity-mining"
                target="_blank"
                rel="noopener noreferrer"
                className="form-link"
              >
                Learn more<span className="outbound-link">{iconOutArrow}</span>
              </a>
            </p>
          </div>
        </div>
      </label>
    </div>
  )
}

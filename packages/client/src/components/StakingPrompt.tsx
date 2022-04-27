import BigNumber from "bignumber.js"
import {displayPercent} from "../utils"
import {iconOutArrow} from "./icons"

type StakingPromptProps = {
  className?: string
  stakingApy?: BigNumber
  onToggle: (boolean) => any
  formVal?: string
}

export default function StakingPrompt({className, stakingApy, onToggle, formVal: _formVal}: StakingPromptProps) {
  const formVal = _formVal || "staking"

  function onChange(e) {
    onToggle(e.currentTarget.checked)
  }

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
            <div>{`I want to stake my supply to earn GFI (additional ${displayPercent(stakingApy)} APY).`}</div>
          </div>
          <div className="form-input-note">
            <p>
              Staking incurs additional gas. Goldfinch incentivizes long term participation, and you will earn maximum
              GFI by staking for at least 12 months.{" "}
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

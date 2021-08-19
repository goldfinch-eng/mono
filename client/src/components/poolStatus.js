import React, { useContext } from "react"
import BigNumber from "bignumber.js"
import { AppContext } from "../App"
import InfoSection from "./infoSection.js"
import RecentRepayments from "./recentRepayments"
import { usdcFromAtomic } from "../ethereum/erc20"
import { displayDollars, displayPercent } from "../utils"
import { iconOutArrow } from "./icons.js"

function PoolStatus(props) {
  const { goldfinchConfig } = useContext(AppContext)

  function deriveRows() {
    let defaultRate
    let poolBalance
    let totalLoansOutstanding
    let capacityRemaining
    let maxPoolCapacity = usdcFromAtomic(goldfinchConfig.totalFundsLimit)
    if (props.poolData.loaded && props.creditDesk && props.creditDesk.gf) {
      defaultRate = props.poolData.cumulativeWritedowns.dividedBy(props.creditDesk.gf.cumulativeDrawdowns)
      poolBalance = usdcFromAtomic(props.poolData.totalPoolAssets)
      totalLoansOutstanding = usdcFromAtomic(props.poolData.totalLoansOutstanding)
      let cappedBalance = BigNumber.min(poolBalance, maxPoolCapacity)
      capacityRemaining = new BigNumber(maxPoolCapacity).minus(cappedBalance)
    }

    return [
      { label: "Total pool balance", value: displayDollars(poolBalance) },
      { label: "Max pool capacity", value: displayDollars(maxPoolCapacity) },
      { label: "Remaining capacity", value: displayDollars(capacityRemaining) },
      { label: "Loans outstanding", value: displayDollars(totalLoansOutstanding) },
      { label: "Default rate", value: displayPercent(defaultRate) },
    ]
  }

  return (
    <div
      className={`pool-status background-container ${
        props.poolData.loaded && props.creditDesk.loaded ? "" : "placeholder"
      }`}
    >
      <h2>Pool Status</h2>
      <InfoSection rows={deriveRows()} />
      <RecentRepayments />
      <div className="pool-links">
        <a href="https://duneanalytics.com/goldfinch/goldfinch" target="_blank" rel="noopener noreferrer">
          Dashboard <span className="outbound-link">{iconOutArrow}</span>
        </a>
        <a
          href="https://etherscan.io/address/0xB01b315e32D1D9B5CE93e296D483e1f0aAD39E75"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pool<span className="outbound-link">{iconOutArrow}</span>
        </a>
      </div>
    </div>
  )
}

export default PoolStatus

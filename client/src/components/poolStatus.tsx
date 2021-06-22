import React from "react"
import InfoSection from "./infoSection.js"
import RecentRepayments from "./recentRepayments"
import { usdcFromAtomic } from "../ethereum/erc20"
import { displayDollars, displayPercent } from "../utils"
import { iconOutArrow } from "./icons.js"
import { PoolData, SeniorFund } from "../ethereum/pool"
import { BigNumber } from "bignumber.js"

interface PoolStatusProps {
  poolData?: PoolData
}

function PoolStatus({poolData}: PoolStatusProps) {
  function deriveRows() {
    let defaultRate: BigNumber | undefined
    let poolBalance: string | undefined
    let totalLoansOutstanding: string | undefined
    if (poolData?.loaded) {
      defaultRate = poolData.defaultRate
      poolBalance = usdcFromAtomic(poolData.totalPoolAssets)
      totalLoansOutstanding = usdcFromAtomic(poolData.totalLoansOutstanding)
    }

    return [
      { label: "Total pool balance", value: displayDollars(poolBalance) },
      { label: "Loans outstanding", value: displayDollars(totalLoansOutstanding) },
      { label: "Default rate", value: displayPercent(defaultRate) },
    ]
  }

  return (
    <div
      className={`pool-status background-container ${
        poolData?.loaded ? "" : "placeholder"
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
          href={`https://etherscan.io/address/${poolData?.pool.address}`}
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
export type { PoolStatusProps }

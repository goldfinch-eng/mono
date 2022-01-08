import {BigNumber} from "bignumber.js"
import {useContext} from "react"
import {AppContext} from "../App"
import {usdcFromAtomic} from "../ethereum/erc20"
import {SeniorPoolLoaded} from "../ethereum/pool"
import {parseSeniorPoolStatus} from "../graphql/parsers"
import {GET_SENIOR_POOL_STATUS} from "../graphql/queries"
import {getSeniorPool} from "../graphql/types"
import useGraphQuerier from "../hooks/useGraphQuerier"
import {SENIOR_POOL_ROUTE} from "../types/routes"
import {displayDollars, displayPercent, shouldUseWeb3} from "../utils"
import {iconOutArrow} from "./icons"
import InfoSection from "./infoSection"
import RecentRepayments from "./recentRepayments"

interface SeniorPoolStatusProps {
  pool: SeniorPoolLoaded | undefined
}

function SeniorPoolStatus(props: SeniorPoolStatusProps) {
  const {goldfinchConfig} = useContext(AppContext)
  const {pool} = props
  const useWeb3 = shouldUseWeb3()
  const {data} = useGraphQuerier<getSeniorPool>(
    {
      route: SENIOR_POOL_ROUTE,
      setAsLeaf: true,
    },
    GET_SENIOR_POOL_STATUS,
    useWeb3
  )

  function deriveRows() {
    // NOTE: Currently, `pool` and `data` do not necessarily relate to the same block number. Therefore
    // they are not guaranteed to be logically consistent with each other. To address this, we must
    // query The Graph for data from the same block number as `pool`, or else use `pool` or `data`
    // exclusively. Consider also the analogous consistency-with-respect-to-block-number issue between
    // these pool status data and data shown elsewhere on the page.

    let poolBalance: string | undefined
    let totalLoansOutstanding: string | undefined
    if (!useWeb3 && data) {
      const result = parseSeniorPoolStatus(data)
      poolBalance = usdcFromAtomic(result.totalPoolAssets)
      totalLoansOutstanding = usdcFromAtomic(result.totalLoansOutstanding)
    } else {
      if (pool) {
        const poolData = pool.info.value.poolData
        poolBalance = usdcFromAtomic(poolData.totalPoolAssets)
        totalLoansOutstanding = usdcFromAtomic(poolData.totalLoansOutstanding)
      }
    }

    let defaultRate: BigNumber | undefined
    let capacityRemaining: BigNumber | undefined
    const maxPoolCapacity: BigNumber | undefined = goldfinchConfig ? goldfinchConfig.totalFundsLimit : undefined
    if (pool && maxPoolCapacity) {
      const poolData = pool.info.value.poolData
      defaultRate = poolData.defaultRate
      capacityRemaining = poolData.remainingCapacity(maxPoolCapacity)
    }

    return [
      {label: "Total pool balance", value: displayDollars(poolBalance)},
      {
        label: "Max pool capacity",
        value: displayDollars(maxPoolCapacity ? usdcFromAtomic(maxPoolCapacity) : undefined),
      },
      {
        label: "Remaining capacity",
        value: displayDollars(capacityRemaining ? usdcFromAtomic(capacityRemaining) : undefined),
      },
      {label: "Loans outstanding", value: displayDollars(totalLoansOutstanding)},
      {label: "Default rate", value: displayPercent(defaultRate)},
    ]
  }

  return (
    <div className={`pool-status background-container ${pool ? "" : "placeholder"}`}>
      <h2>Pool Status</h2>
      <InfoSection rows={deriveRows()} />
      <RecentRepayments />
      <div className="pool-links">
        <a href={"https://dune.xyz/goldfinch/goldfinch"} target="_blank" rel="noopener noreferrer">
          Dashboard<span className="outbound-link">{iconOutArrow}</span>
        </a>
        <a href={pool ? `https://etherscan.io/address/${pool.address}` : ""} target="_blank" rel="noopener noreferrer">
          Pool<span className="outbound-link">{iconOutArrow}</span>
        </a>
      </div>
    </div>
  )
}

export default SeniorPoolStatus
export type {SeniorPoolStatusProps}

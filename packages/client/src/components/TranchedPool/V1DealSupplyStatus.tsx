import {BigNumber} from "bignumber.js"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {PoolState, TranchedPool} from "../../ethereum/tranchedPool"
import {displayDollars, roundUpPenny} from "../../utils"
import CreditBarViz from "../creditBarViz"
import InfoSection from "../infoSection"

export function V1DealSupplyStatus({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
  if (!tranchedPool) {
    return <></>
  }

  let juniorContribution = new BigNumber(tranchedPool.juniorTranche.principalDeposited)
  let remainingJuniorCapacity = tranchedPool.creditLine.limit.minus(juniorContribution)

  let rows: Array<{label: string; value: string}> = [
    {
      label: "Senior Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(juniorContribution))),
    },
    {label: "Leverage Ratio", value: "N/A"},
    {
      label: "Total Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(juniorContribution))),
    },
  ]

  let rightAmountPrefix = ""
  let rightAmountDescription = "Remaining"
  if (tranchedPool.poolState === PoolState.Open) {
    // Show an "approx." sign if the junior tranche is not yet locked
    rightAmountPrefix = "~"
    rightAmountDescription = "Est. Remaining"
  }

  return (
    <div className="background-container">
      <h2>Capital Supply</h2>
      <div className="credit-status-balance background-container-inner">
        <CreditBarViz
          leftAmount={new BigNumber(usdcFromAtomic(juniorContribution))}
          leftAmountDisplay={displayDollars(usdcFromAtomic(juniorContribution))}
          leftAmountDescription={"From the Senior Pool"}
          rightAmount={new BigNumber(usdcFromAtomic(remainingJuniorCapacity))}
          rightAmountDisplay={`${rightAmountPrefix}${displayDollars(usdcFromAtomic(remainingJuniorCapacity))}`}
          rightAmountDescription={rightAmountDescription}
        />
      </div>
      <InfoSection rows={rows} />
    </div>
  )
}

import {BigNumber} from "bignumber.js"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {PoolState, TranchedPool} from "../../ethereum/tranchedPool"
import {displayDollars, roundUpPenny} from "../../utils"
import CreditBarViz from "../creditBarViz"
import InfoSection from "../infoSection"
import {useUniqueJuniorSuppliers} from "./hooks/useUniqueJuniorSuppliers"

export function SupplyStatus({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
  const remainingJuniorCapacity = tranchedPool?.remainingJuniorCapacity()
  const uniqueJuniorSuppliers = useUniqueJuniorSuppliers({tranchedPool})

  if (!tranchedPool) {
    return <></>
  }

  let juniorContribution = new BigNumber(tranchedPool?.juniorTranche.principalDeposited)
  let seniorContribution = new BigNumber(tranchedPool?.seniorTranche.principalDeposited).plus(
    tranchedPool.estimatedSeniorPoolContribution
  )

  let rows: Array<{label: string; value: string}> = [
    {
      label: "Senior Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(seniorContribution))),
    },
    {label: "Leverage Ratio", value: `${tranchedPool.estimatedLeverageRatio.toString()}x`},
    {
      label: "Total Capital Supply",
      value: displayDollars(roundUpPenny(usdcFromAtomic(tranchedPool.estimatedTotalAssets()))),
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
          leftAmountDescription={
            uniqueJuniorSuppliers === 1
              ? `From ${uniqueJuniorSuppliers} Backer`
              : `From ${uniqueJuniorSuppliers} Backers`
          }
          rightAmount={remainingJuniorCapacity ? new BigNumber(usdcFromAtomic(remainingJuniorCapacity)) : undefined}
          rightAmountDisplay={
            remainingJuniorCapacity
              ? `${rightAmountPrefix}${displayDollars(usdcFromAtomic(remainingJuniorCapacity))}`
              : undefined
          }
          rightAmountDescription={rightAmountDescription}
        />
      </div>
      <InfoSection rows={rows} />
    </div>
  )
}

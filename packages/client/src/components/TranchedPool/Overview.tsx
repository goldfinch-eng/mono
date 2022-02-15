import compact from "lodash/compact"
import {useContext} from "react"
import {AppContext} from "../../App"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {TranchedPool} from "../../ethereum/tranchedPool"
import {useSession} from "../../hooks/useSignIn"
import {displayDollars, displayPercent, roundUpPenny} from "../../utils"
import EtherscanLink from "../etherscanLink"
import {iconOutArrow} from "../icons"
import InfoSection from "../infoSection"

export function Overview({
  tranchedPool,
  handleDetails,
}: {
  tranchedPool: TranchedPool | undefined
  handleDetails: () => void
}) {
  const {user} = useContext(AppContext)
  const session = useSession()

  let rows: Array<{label: string; value: string}> = []
  if (tranchedPool) {
    let backerAPY = tranchedPool.estimateJuniorAPY(tranchedPool.estimatedLeverageRatio)
    let backerBoost = backerAPY.minus(tranchedPool.creditLine.interestAprDecimal)
    rows = compact([
      {label: "Credit limit", value: displayDollars(roundUpPenny(usdcFromAtomic(tranchedPool.creditLine.limit)))},
      {label: "Base Borrower APR", value: displayPercent(tranchedPool.creditLine.interestAprDecimal)},
      !backerBoost.isZero() && {label: "Est. Backer APR boost", value: displayPercent(backerBoost)},
      {
        label: "Payment frequency",
        value:
          tranchedPool.creditLine.paymentPeriodInDays.toString() === "1"
            ? `${tranchedPool.creditLine.paymentPeriodInDays} day`
            : `${tranchedPool.creditLine.paymentPeriodInDays} days`,
      },
      {
        label: "Payback term",
        value:
          tranchedPool.creditLine.termInDays.toString() === "1"
            ? `${tranchedPool.creditLine.termInDays} day`
            : `${tranchedPool.creditLine.termInDays} days`,
      },
    ])
  }

  let detailsLink = <></>
  if (user && user.info.value.goListed && session.status === "authenticated" && tranchedPool?.metadata?.detailsUrl) {
    detailsLink = (
      <div className="pool-links">
        <button onClick={() => handleDetails()}>
          Details & Discussion <span className="outbound-link">{iconOutArrow}</span>
        </button>
      </div>
    )
  }

  return (
    <div className={`pool-overview background-container ${!tranchedPool && "placeholder"}`}>
      <div className="pool-header">
        <h2>Overview</h2>
        {detailsLink}
      </div>
      <p className="pool-description">{tranchedPool?.metadata?.description}</p>
      <InfoSection rows={rows} />
      <div className="pool-links">
        <EtherscanLink address={tranchedPool?.address!}>
          Pool<span className="outbound-link">{iconOutArrow}</span>
        </EtherscanLink>
      </div>
    </div>
  )
}

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

export function Overview({tranchedPool, handleDetails}: {tranchedPool: TranchedPool; handleDetails: () => void}) {
  const {user} = useContext(AppContext)
  const session = useSession()

  let rows: Array<{label: string; value: string}> = []
  if (tranchedPool) {
    let backerAPY = tranchedPool.estimateJuniorAPY(tranchedPool.estimatedLeverageRatio)
    let backerBoost = backerAPY.minus(tranchedPool.creditLine.interestAprDecimal)
    rows = compact([
      {label: "Drawdown cap", value: displayDollars(roundUpPenny(usdcFromAtomic(tranchedPool.creditLine.limit)))},
      {label: "Interest rate APR", value: displayPercent(tranchedPool.creditLine.interestAprDecimal)},
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
  if (user && user.info.value.goListed && session.status === "authenticated" && tranchedPool.metadata?.detailsUrl) {
    detailsLink = (
      <div className="pool-links pool-overview-links">
        <button onClick={() => handleDetails()}>
          Details & Discussion <span className="outbound-link">{iconOutArrow}</span>
        </button>
      </div>
    )
  }

  return (
    <div className={`pool-overview background-container ${!tranchedPool && "placeholder"}`}>
      <div className="background-container-inner">
        <div className="pool-header">
          <h2 className="pool-overview-title">Overview</h2>
          <div className="pool-links pool-overview-links">
            {detailsLink}
            {tranchedPool.metadata?.agreement && (
              <a
                href={tranchedPool.metadata?.agreement}
                target="_blank"
                rel="noreferrer"
                className="pool-links pool-overview-links"
              >
                Dataroom {iconOutArrow}
              </a>
            )}
            <EtherscanLink address={tranchedPool.address!} txHash={undefined}>
              Pool<span className="outbound-link">{iconOutArrow}</span>
            </EtherscanLink>
          </div>
        </div>
        <p className="pool-description">{tranchedPool.metadata?.description}</p>
      </div>
      <InfoSection rows={rows} classNames="pool-info-section" />
    </div>
  )
}

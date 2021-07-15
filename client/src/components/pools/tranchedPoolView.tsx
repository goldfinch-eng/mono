import {useState, useEffect, useContext} from "react"
import {useParams} from "react-router-dom"
import ConnectionNotice from "../connectionNotice"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {TranchedPool} from "../../ethereum/tranchedPool"
import {croppedAddress, displayDollars, displayPercent, roundUpPenny} from "../../utils"
import InfoSection from "../infoSection"
import {usdcFromAtomic} from "../../ethereum/erc20"
import {iconOutArrow} from "../icons.js"

function useTranchedPool({goldfinchProtocol, address}: {goldfinchProtocol?: GoldfinchProtocol; address: string}): {
  tranchedPool?: TranchedPool
  status: string
} {
  let [tranchedPool, setTranchedPool] = useState<TranchedPool>()
  let [status, setStatus] = useState<string>("loading")

  useEffect(() => {
    async function loadTranchedPool(address: string, goldfinchProtocol: GoldfinchProtocol) {
      let tranchedPool = new TranchedPool(address, goldfinchProtocol)
      await tranchedPool.initialize()
      setTranchedPool(tranchedPool)
      setStatus("loaded")
    }

    if (goldfinchProtocol) {
      loadTranchedPool(address, goldfinchProtocol)
    }
  }, [address, goldfinchProtocol])

  return {tranchedPool, status}
}

function Overview({tranchedPool}: {tranchedPool?: TranchedPool}) {
  let rows: Array<{label: string; value: string}> = []
  if (tranchedPool) {
    rows = [
      {label: "Credit limit", value: displayDollars(roundUpPenny(usdcFromAtomic(tranchedPool.creditLine.limit)))},
      {label: "Interest rate APR", value: displayPercent(tranchedPool.creditLine.interestAprDecimal)},
      {label: "Payment frequency", value: `${tranchedPool.creditLine.paymentPeriodInDays} days`},
      {label: "Payback term", value: `${tranchedPool.creditLine.termInDays} days`},
    ]
  }

  return (
    <div className={`pool-overview background-container ${!tranchedPool && "placeholder"}`}>
      <div className="pool-header">
        <h2>Overview</h2>
        {tranchedPool?.metadata?.detailsUrl && (
          <div className="pool-links">
            <a href={tranchedPool.metadata.detailsUrl} target="_blank" rel="noopener noreferrer">
              Details & Discussion <span className="outbound-link">{iconOutArrow}</span>
            </a>
          </div>
        )}
      </div>
      <p className="pool-description">{tranchedPool?.metadata?.description}</p>
      <InfoSection rows={rows} />
    </div>
  )
}

function TranchedPoolView() {
  const {poolAddress} = useParams()
  const {goldfinchProtocol} = useContext(AppContext)
  const {tranchedPool} = useTranchedPool({address: poolAddress, goldfinchProtocol})

  let earnMessage = "Loading..."
  if (tranchedPool) {
    earnMessage = `Earn Portfolio / ${tranchedPool.metadata?.name ?? croppedAddress(tranchedPool.address)}`
  }

  return (
    <div className="content-section">
      <div className="page-header">
        <InvestorNotice />
        <div>{earnMessage}</div>
      </div>
      <ConnectionNotice requireVerify={true} />
      <Overview tranchedPool={tranchedPool} />
    </div>
  )
}

export default TranchedPoolView

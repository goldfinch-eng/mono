import {useState, useEffect, useContext} from "react"
import {useParams} from "react-router-dom"
import ConnectionNotice from "../connectionNotice"
import {AppContext} from "../../App"
import InvestorNotice from "../investorNotice"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {TranchedPool} from "../../ethereum/tranchedPool"
import {croppedAddress} from "../../utils"

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
    </div>
  )
}

export default TranchedPoolView

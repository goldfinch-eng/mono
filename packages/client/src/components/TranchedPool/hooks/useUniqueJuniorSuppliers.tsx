import {useContext} from "react"
import {AppContext} from "../../../App"
import {TranchedPool, TRANCHES} from "../../../ethereum/tranchedPool"
import {useAsync} from "../../../hooks/useAsync"
import {DEPOSIT_MADE_EVENT} from "../../../types/events"

export function useUniqueJuniorSuppliers({tranchedPool}: {tranchedPool: TranchedPool | undefined}) {
  let uniqueSuppliers = 0
  const {goldfinchProtocol, currentBlock} = useContext(AppContext)

  let depositsQuery = useAsync(async () => {
    if (!tranchedPool || !goldfinchProtocol || !currentBlock) {
      return []
    }
    return await goldfinchProtocol.queryEvents(
      tranchedPool.contract.readOnly,
      [DEPOSIT_MADE_EVENT],
      {
        tranche: TRANCHES.Junior.toString(),
      },
      currentBlock.number
    )
  }, [tranchedPool, goldfinchProtocol, currentBlock])

  if (depositsQuery.status === "succeeded") {
    uniqueSuppliers = new Set(depositsQuery.value.map((e) => e.returnValues.owner)).size
  }

  return uniqueSuppliers
}

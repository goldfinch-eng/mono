import {useAsync} from "../../../hooks/useAsync"
import {TranchedPool, TranchedPoolRecentTransactionData} from "../../../ethereum/tranchedPool"
import {BlockInfo} from "../../../utils"

export function useRecentPoolTransactions({
  tranchedPool,
  currentBlock,
}: {
  tranchedPool: TranchedPool | undefined
  currentBlock: BlockInfo | undefined
}): TranchedPoolRecentTransactionData[] {
  let recentTransactions = useAsync(
    () => tranchedPool && currentBlock && tranchedPool.recentTransactions(currentBlock),
    [tranchedPool, currentBlock]
  )
  if (recentTransactions.status === "succeeded") {
    return recentTransactions.value
  }
  return []
}

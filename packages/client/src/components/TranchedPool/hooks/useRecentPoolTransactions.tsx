import {useAsync} from "../../../hooks/useAsync"
import {TranchedPool} from "../../../ethereum/tranchedPool"
import {BlockInfo} from "../../../utils"

export function useRecentPoolTransactions({
  tranchedPool,
  currentBlock,
}: {
  tranchedPool: TranchedPool | undefined
  currentBlock: BlockInfo | undefined
}): Record<string, any>[] {
  let recentTransactions = useAsync(
    () => tranchedPool && currentBlock && tranchedPool.recentTransactions(currentBlock),
    [tranchedPool, currentBlock]
  )
  if (recentTransactions.status === "succeeded") {
    return recentTransactions.value
  }
  return []
}

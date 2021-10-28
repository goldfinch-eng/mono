import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {RefreshFn, useAsync, useAsyncFn, useStaleWhileRevalidating} from "./useAsync"
import {PoolBacker, TranchedPool} from "../ethereum/tranchedPool"
import {useContext, useEffect} from "react"
import {User} from "../ethereum/user"
import {AppContext} from "../App"
import {BlockInfo} from "../utils"

function useTranchedPool({
  goldfinchProtocol,
  currentBlock,
  address,
}: {
  goldfinchProtocol: GoldfinchProtocol | undefined
  currentBlock: BlockInfo | undefined
  address: string
}): [TranchedPool | undefined, RefreshFn] {
  let [result, refresh] = useAsyncFn<TranchedPool>(() => {
    if (!goldfinchProtocol || !currentBlock) {
      return
    }

    let tranchedPool = new TranchedPool(address, goldfinchProtocol)
    return tranchedPool.initialize(currentBlock).then(() => tranchedPool)
  }, [address, goldfinchProtocol, currentBlock])
  const tranchedPool = useStaleWhileRevalidating(result)

  useEffect(refresh, [refresh])

  return [tranchedPool, refresh]
}

function useBacker({user, tranchedPool}: {user: User; tranchedPool?: TranchedPool}): PoolBacker | undefined {
  const {goldfinchProtocol, currentBlock} = useContext(AppContext)
  let backerResult = useAsync<PoolBacker>(() => {
    if (!user.address || !tranchedPool || !goldfinchProtocol || !currentBlock) {
      return
    }

    let backer = new PoolBacker(user.address, tranchedPool, goldfinchProtocol)
    return backer.initialize(currentBlock).then(() => backer)
  }, [user.address, tranchedPool, goldfinchProtocol, currentBlock])

  const backer = useStaleWhileRevalidating(backerResult)

  return backer
}

export {useTranchedPool, useBacker}

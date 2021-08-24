import {GoldfinchProtocol} from "../ethereum/GoldfinchProtocol"
import {AsyncResult, RefreshFn, useAsync, useAsyncFn} from "./useAsync"
import {PoolBacker, TranchedPool} from "../ethereum/tranchedPool"
import {useContext, useEffect} from "react"
import {User} from "../ethereum/user"
import {AppContext} from "../App"

function useTranchedPool({
  goldfinchProtocol,
  address,
}: {
  goldfinchProtocol?: GoldfinchProtocol
  address: string
}): [AsyncResult<TranchedPool>, RefreshFn] {
  let [result, refresh] = useAsyncFn<TranchedPool>(() => {
    if (!goldfinchProtocol) {
      return
    }

    let tranchedPool = new TranchedPool(address, goldfinchProtocol)
    return tranchedPool.initialize().then(() => tranchedPool)
  }, [address, goldfinchProtocol])

  useEffect(refresh, [refresh])

  return [result, refresh]
}

function useBacker({user, tranchedPool}: {user: User; tranchedPool?: TranchedPool}): PoolBacker | undefined {
  const {goldfinchProtocol} = useContext(AppContext)
  let backerResult = useAsync<PoolBacker>(() => {
    if (!user.loaded || !tranchedPool || !goldfinchProtocol) {
      return
    }

    let backer = new PoolBacker(user.address, tranchedPool, goldfinchProtocol)
    return backer.initialize().then(() => backer)
  }, [user, tranchedPool, goldfinchProtocol])

  if (backerResult.status === "succeeded") {
    return backerResult.value
  }
  return
}

export {useTranchedPool, useBacker}

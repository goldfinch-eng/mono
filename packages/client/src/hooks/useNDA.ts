import {useEffect} from "react"
import {AppContext} from "../App"
import {TranchedPool} from "../ethereum/tranchedPool"
import {UserLoaded} from "../ethereum/user"
import {useAsyncFn, useStaleWhileRevalidating} from "./useAsync"
import {ReadOnlyGoldfinchClient} from "./useGoldfinchClient"
import useNonNullContext from "./useNonNullContext"

export function useFetchNDA({user, tranchedPool}: {user?: UserLoaded; tranchedPool?: TranchedPool}) {
  const {network} = useNonNullContext(AppContext)

  const [result, refresh] = useAsyncFn(() => {
    if (!user || !tranchedPool?.address || !tranchedPool?.metadata?.NDAUrl || !tranchedPool?.metadata?.detailsUrl) {
      return
    }

    const client = new ReadOnlyGoldfinchClient(network.name!)
    return client.fetchNDA(user.address, tranchedPool!.address).then((r) => r.json)
  }, [network, user?.address, tranchedPool?.address])
  const nda = useStaleWhileRevalidating(result)

  useEffect(refresh, [refresh])

  return [nda, refresh]
}

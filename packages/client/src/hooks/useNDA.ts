import {useEffect} from "react"
import {AppContext} from "../App"
import {TranchedPool} from "../ethereum/tranchedPool"
import {User} from "../ethereum/user"
import {useAsyncFn, useStaleWhileRevalidating} from "./useAsync"
import DefaultGoldfinchClient from "./useGoldfinchClient"
import useNonNullContext from "./useNonNullContext"
import {useSignIn} from "./useSignIn"

export function useFetchNDA({user, tranchedPool}: {user: User; tranchedPool?: TranchedPool}) {
  const {network, setSessionData} = useNonNullContext(AppContext)
  const [session] = useSignIn()

  const [result, refresh] = useAsyncFn(() => {
    if (
      session.status !== "authenticated" ||
      !user.address ||
      !tranchedPool?.address ||
      !tranchedPool?.metadata?.NDAUrl ||
      !tranchedPool?.metadata?.detailsUrl
    ) {
      return
    }
    const client = new DefaultGoldfinchClient(network.name!, session, setSessionData)
    return client.fetchNDA(user.address, tranchedPool!.address).then((r) => r.json)
  }, [session.status, network, user.address, tranchedPool?.address])
  const nda = useStaleWhileRevalidating(result)

  useEffect(refresh, [refresh])

  return [nda, refresh]
}

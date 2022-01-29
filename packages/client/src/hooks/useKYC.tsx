import {useContext} from "react"
import {AppContext} from "../App"
import {UserLoaded} from "../ethereum/user"
import {assertNonNullable} from "../utils"
import {AsyncResult, useAsync} from "./useAsync"
import DefaultGoldfinchClient, {KYC} from "./useGoldfinchClient"
import {useSignIn} from "./useSignIn"

export function useKYC(): AsyncResult<KYC> {
  const {user, network, setSessionData} = useContext(AppContext)
  const [session] = useSignIn()
  const result = useAsync(() => {
    if (session.status !== "authenticated" || !network?.name) {
      return
    }
    assertNonNullable(user)
    assertNonNullable(setSessionData)
    const client = new DefaultGoldfinchClient(network.name, session, setSessionData)
    const promise = client.fetchKYCStatus(user.address)
    return promise.then((response) => response.json)
  }, [session.status, network, setSessionData, user?.address])

  return result
}

export function eligibleForSeniorPool(user: UserLoaded | undefined): boolean {
  const goListed = !!user && user.info.value.goListed
  return goListed
}

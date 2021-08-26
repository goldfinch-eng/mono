import {ethers} from "ethers"
import {useCallback, useContext} from "react"
import {AppContext} from "../App"
import {assertNonNullable} from "../utils"
import web3 from "../web3"

export type Session = {status: "unknown"} | {status: "known"} | {status: "authenticated"; signature: string}

function getSession(address: string | undefined, sessionSignature: string | undefined): Session {
  if (address && sessionSignature) {
    return {status: "authenticated", signature: sessionSignature}
  }
  if (address && !sessionSignature) {
    return {status: "known"}
  }
  return {status: "unknown"}
}

export function useSession(): Session {
  const {sessionSignature, user} = useContext(AppContext)
  return getSession(user.address, sessionSignature)
}

export function useSignIn(): [status: Session, signIn: () => Promise<Session>] {
  const {setSessionSignature, user} = useContext(AppContext)
  const session = useSession()

  const signIn = useCallback(
    async function () {
      assertNonNullable(setSessionSignature)

      const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
      const signer = provider.getSigner(user.address)
      const signature = await signer.signMessage("Sign in to Goldfinch")
      setSessionSignature(signature)
      return getSession(user.address, signature)
    },
    [user, setSessionSignature],
  )

  return [session, signIn]
}

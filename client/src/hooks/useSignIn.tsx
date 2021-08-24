import {ethers} from "ethers"
import {useCallback, useContext} from "react"
import {AppContext} from "../App"
import {assertNonNullable, getBlockInfo, getCurrentBlock} from "../utils"
import web3 from "../web3"

export type Session = {status: "unknown"} | {status: "known"} | {status: "authenticated"; signature: string}

function getSession(address: string, signature: string | undefined): Session {
  if (address && signature) {
    return {status: "authenticated", signature}
  }
  if (address && !signature) {
    return {status: "known"}
  }
  return {status: "unknown"}
}

export function useSession(): Session {
  const {sessionData, user} = useContext(AppContext)
  return getSession(user.address, sessionData?.signature)
}

export function useSignIn(): [status: Session, signIn: () => Promise<Session>] {
  const {setSessionData, user} = useContext(AppContext)
  const session = useSession()

  const signIn = useCallback(
    async function () {
      assertNonNullable(setSessionData)

      const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
      const signer = provider.getSigner(user.address)

      const currentBlock = getBlockInfo(await getCurrentBlock())
      const signatureBlockNum = currentBlock.number
      const signatureBlockNumTimestamp = currentBlock.timestamp

      const signature = await signer.signMessage(`Sign in to Goldfinch: ${signatureBlockNum}`)
      setSessionData({signature, signatureBlockNum, signatureBlockNumTimestamp})
      return getSession(user.address, signature)
    },
    [user, setSessionData],
  )

  return [session, signIn]
}

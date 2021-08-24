import {ethers} from "ethers"
import {useCallback, useContext} from "react"
import {AppContext} from "../App"
import {assertNonNullable, getBlockInfo, getCurrentBlock} from "../utils"
import web3 from "../web3"

export type Session =
  | {status: "unknown"}
  | {status: "known"}
  | {status: "authenticated"; signature: string; signatureBlockNum: number}

type GetSessionInfo =
  | {
      address: string
      signature: undefined
      signatureBlockNum: undefined
    }
  | {
      address: string
      signature: string
      signatureBlockNum: number
    }

function getSession(info: GetSessionInfo): Session {
  if (info.address && info.signature) {
    const signature = info.signature
    const signatureBlockNum = info.signatureBlockNum
    return {status: "authenticated", signature, signatureBlockNum}
  }
  if (info.address && !info.signature) {
    return {status: "known"}
  }
  return {status: "unknown"}
}

export function useSession(): Session {
  const {sessionData, user} = useContext(AppContext)
  return getSession(
    sessionData
      ? {address: user.address, signature: sessionData.signature, signatureBlockNum: sessionData.signatureBlockNum}
      : {address: user.address, signature: undefined, signatureBlockNum: undefined},
  )
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
      return getSession({address: user.address, signature, signatureBlockNum})
    },
    [user, setSessionData],
  )

  return [session, signIn]
}

import {isNumber, PlainObject} from "@goldfinch-eng/utils/src/type"
import {ethers} from "ethers"
import difference from "lodash/difference"
import {useCallback, useContext, useEffect, useState} from "react"
import {AppContext} from "../App"
import {SESSION_DATA_VERSION} from "../types/session"
import {assertNonNullable} from "../utils"
import web3 from "../web3"

export type UnknownSession = {status: "unknown"}
export type KnownSession = {status: "known"}
export type AuthenticatedSession = {status: "authenticated"; signature: string; signatureBlockNum: number}
export type Session = UnknownSession | KnownSession | AuthenticatedSession

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
      signatureBlockNumTimestamp: number
      version: number
    }

interface SessionLocalStorageType {
  localStorageValue: any
  setLocalStorageValue: (value: any) => void
}

function getSession(info: GetSessionInfo | undefined): Session {
  if (info) {
    if (info.address && info.signature) {
      const signature = info.signature
      const signatureBlockNum = info.signatureBlockNum
      return {status: "authenticated", signature, signatureBlockNum}
    } else {
      return {status: "known"}
    }
  } else {
    return {status: "unknown"}
  }
}

export function useSession(): Session {
  const {sessionData, user} = useContext(AppContext)
  return getSession(
    user
      ? sessionData
        ? {
            address: user.address,
            signature: sessionData.signature,
            signatureBlockNum: sessionData.signatureBlockNum,
            signatureBlockNumTimestamp: sessionData.signatureBlockNumTimestamp,
            version: sessionData.version,
          }
        : {address: user.address, signature: undefined, signatureBlockNum: undefined}
      : undefined
  )
}

export function useSignIn(): [status: Session, signIn: () => Promise<Session>] {
  const {setSessionData, user, currentBlock} = useContext(AppContext)
  const session = useSession()

  const signIn = useCallback(
    async function () {
      assertNonNullable(user)
      assertNonNullable(setSessionData)
      assertNonNullable(currentBlock)

      const provider = new ethers.providers.Web3Provider(web3.userWallet.currentProvider as any)
      const signer = provider.getSigner(user.address)

      const signatureBlockNum = currentBlock.number
      const signatureBlockNumTimestamp = currentBlock.timestamp
      const version = SESSION_DATA_VERSION
      let signature: string | undefined
      try {
        signature = await signer.signMessage(`Sign in to Goldfinch: ${signatureBlockNum}`)
      } catch (err: unknown) {
        if ((err as any).code === 4001) {
          // The user denied the request.
        } else {
          throw err
        }
      }
      if (signature) {
        setSessionData({signature, signatureBlockNum, signatureBlockNumTimestamp, version})
        return getSession({address: user.address, signature, signatureBlockNum, signatureBlockNumTimestamp, version})
      } else {
        setSessionData(undefined)
        return getSession({address: user.address, signature: undefined, signatureBlockNum: undefined})
      }
    },
    [user, setSessionData, currentBlock]
  )

  return [session, signIn]
}

const sessionDataFormatSchema = {
  signature: (value: unknown) => typeof value === "string" && value !== undefined,
  signatureBlockNum: (value: unknown) => typeof value === "number" && value !== undefined,
  signatureBlockNumTimestamp: (value: unknown) => typeof value === "number" && value !== undefined,
  version: (value: unknown) => typeof value === "number" && value !== undefined,
}

const validateSessionDataFormat = (object: PlainObject): Error[] => {
  const requiredKeys = Object.keys(sessionDataFormatSchema)
  const requiredKeysErrors = Object.keys(sessionDataFormatSchema)
    .filter((key) => !sessionDataFormatSchema[key](object[key]))
    .map((key) => new Error(`${key} is invalid.`))

  const extraKeys = difference(Object.keys(object), requiredKeys)
  const extraKeysErrors = extraKeys.length ? [new Error(`${extraKeys} are invalid.`)] : []

  return requiredKeysErrors.concat(extraKeysErrors)
}

function isSessionDataFormatInvalid(storedInfo: PlainObject | undefined): boolean {
  if (!storedInfo) {
    return true
  }
  const errors = validateSessionDataFormat(storedInfo)
  return errors.length > 0
}

const EXPIRY_IN_SECONDS = 24 * 60 * 60 // 24 hours in seconds

function isSessionDataExpired(timestamp: number | undefined, currentTimestamp: number | undefined): boolean {
  if (currentTimestamp) {
    if (timestamp) {
      const difference = currentTimestamp - timestamp
      return EXPIRY_IN_SECONDS < difference
    } else {
      return true
    }
  } else {
    return false
  }
}

function getLocalStorageOrDefault(
  key: string,
  defaultValue: PlainObject,
  currentTimestamp: number | undefined
): PlainObject {
  const stored = localStorage.getItem(key)
  if (!stored) {
    return defaultValue
  }
  try {
    const sessionData = JSON.parse(stored)

    if (isSessionDataInvalid(sessionData, currentTimestamp)) {
      localStorage.removeItem(key)
      return defaultValue
    }

    return sessionData
  } catch (e) {
    // This protects against the corruption of localStorage value, due to some manual edit or frontend version upgrade.
    localStorage.removeItem(key)
    return defaultValue
  }
}

export function isSessionDataInvalid(sessionData: PlainObject | undefined, currentTimestamp: number | undefined) {
  const signatureBlockNumTimestamp =
    sessionData && "signatureBlockNumTimestamp" in sessionData && isNumber(sessionData.signatureBlockNumTimestamp)
      ? sessionData.signatureBlockNumTimestamp
      : undefined
  return isSessionDataFormatInvalid(sessionData) || isSessionDataExpired(signatureBlockNumTimestamp, currentTimestamp)
}

export function useSessionLocalStorage(
  key: string,
  defaultValue: PlainObject,
  currentTimestamp: number | undefined
): SessionLocalStorageType {
  const [localStorageValue, setLocalStorageValue] = useState(
    getLocalStorageOrDefault(key, defaultValue, currentTimestamp)
  )

  useEffect(() => {
    const value = isSessionDataInvalid(localStorageValue, currentTimestamp) ? defaultValue : localStorageValue
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, localStorageValue, defaultValue, currentTimestamp])

  return {localStorageValue, setLocalStorageValue}
}

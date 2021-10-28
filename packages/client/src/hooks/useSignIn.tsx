import {ethers} from "ethers"
import {useCallback, useContext, useState, useEffect} from "react"
import {AppContext} from "../App"
import {assertNonNullable, getBlockInfo, getCurrentBlock} from "../utils"
import web3 from "../web3"
import {SESSION_DATA_VERSION} from "../types/session"
import {isNumber, PlainObject} from "@goldfinch-eng/utils/src/type"
import difference from "lodash/difference"

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
      ? {
          address: user.address,
          signature: sessionData.signature,
          signatureBlockNum: sessionData.signatureBlockNum,
          signatureBlockNumTimestamp: sessionData.signatureBlockNumTimestamp,
          version: sessionData.version,
        }
      : {address: user.address, signature: undefined, signatureBlockNum: undefined}
  )
}

export function useSignIn(): [status: Session, signIn: () => Promise<Session>] {
  const {setSessionData, user, currentBlock} = useContext(AppContext)
  const session = useSession()

  const signIn = useCallback(
    async function () {
      assertNonNullable(setSessionData)
      assertNonNullable(currentBlock)

      const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
      const signer = provider.getSigner(user.address)

      const signatureBlockNum = currentBlock.number
      const signatureBlockNumTimestamp = currentBlock.timestamp
      const version = SESSION_DATA_VERSION
      const signature = await signer.signMessage(`Sign in to Goldfinch: ${signatureBlockNum}`)
      setSessionData({signature, signatureBlockNum, signatureBlockNumTimestamp, version})
      return getSession({address: user.address, signature, signatureBlockNum, signatureBlockNumTimestamp, version})
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

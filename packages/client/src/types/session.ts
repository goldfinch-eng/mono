export const SESSION_DATA_VERSION = 1

export type SessionData = {
  signature: string
  signatureBlockNum: number
  signatureBlockNumTimestamp: number
  version: number
}

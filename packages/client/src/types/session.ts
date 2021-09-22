export type SessionData = {
  signature: string
  signatureBlockNum: number
  // We include the signature block number's timestamp, to support in future being
  // proactive about considering the signature to be expired based on the passage
  // of block time. (Currently, we are not thusly proactive; we reset the session
  // state only if the server rejects an attempt to use the signature.)
  signatureBlockNumTimestamp: number
}

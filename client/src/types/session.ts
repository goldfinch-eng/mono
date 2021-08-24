export type SessionData = {
  signature: string
  // We include the signature block number and its corresponding timestamp,
  // to support in future being proactive about considering the signature to be expired
  // based on the passage of block time. (Currently, we are not thusly proactive;
  // we reset the session state only if the server rejects an attempt to
  // use the signature.)
  signatureBlockNum: number
  signatureBlockNumTimestamp: number
}

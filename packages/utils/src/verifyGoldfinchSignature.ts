import {ethers} from "ethers"

class SignatureVerificationError extends Error {}
class InvalidBlockNumberError extends SignatureVerificationError {}
class FutureBlockNumberError extends SignatureVerificationError {}
class SignatureDoesNotMatchAddressError extends SignatureVerificationError {}
class SignatureExpiredError extends SignatureVerificationError {}

const genVerificationMessage = (blockNum: number) => `Sign in to Goldfinch: ${blockNum}`
const ONE_DAY_SECONDS = 60 * 60 * 24

/**
 * Verifies that the `signature` provided is a valid message signed by the address provided in `address`.
 *
 * Also verifies that this signature has not expired, per the provided `signatureBlockNum` header -- which is
 * critical so that signatures can't confer privileges forever.
 *
 * This form of authentication is meant to support requests that we want only the end user, who
 * controls the private key behind the address, to be able to perform.
 *
 * If verification fails, we throw an error with class corresponding to error reason and an error message..
 * If verification succeeds, then the function returns without error.
 *
 * NOTE: Most functionality taken from @goldfinch's mono/packages/functions/src/helpers.ts
 *
 * @param {string} address Claimed address associated with the signature
 * @param {string} signature Signature to verify
 * @param {string} signatureBlockNum Block number used to generate message used for signing.
 * @throws SignatureVerificationError
 */
export const verifySignature = async (
  address: string,
  signature: string,
  signatureBlockNumStr: string,
  blockchainProvider: ethers.providers.Provider
) => {
  const signatureBlockNum = parseInt(signatureBlockNumStr, 10)
  if (!Number.isInteger(signatureBlockNum)) {
    throw new InvalidBlockNumberError("Invalid signature block number.")
  }

  const verifiedAddress = ethers.utils.verifyMessage(genVerificationMessage(signatureBlockNum), signature)

  console.debug(`Received address: ${address}, Verified address: ${verifiedAddress}`)

  if (address.toLowerCase() !== verifiedAddress.toLowerCase()) {
    throw new SignatureDoesNotMatchAddressError("Invalid address or signature.")
  }

  const currentBlock = await blockchainProvider.getBlock("latest")

  // Don't allow signatures signed for the future.
  if (currentBlock.number < signatureBlockNum) {
    throw new FutureBlockNumberError(`Unexpected signature block number: ${currentBlock.number} < ${signatureBlockNum}`)
  }

  const signatureBlock = await blockchainProvider.getBlock(signatureBlockNum)
  const signatureTime = signatureBlock.timestamp
  const now = currentBlock.timestamp

  // Don't allow signatures more than a day old.
  if (signatureTime + ONE_DAY_SECONDS < now) {
    throw new SignatureExpiredError(`Signature expired: ${signatureTime} + ${ONE_DAY_SECONDS} < ${now}`)
  }
}

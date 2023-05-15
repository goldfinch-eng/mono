import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"

/**
 * Types of authentication on our cloud functions:
 *
 * signature
 *  Address in the x-goldfinch-address header must match the signer of
 *  the payload in the x-goldfinch-signature header
 *
 * signatureWithAllowList
 *  Meet all the requirements for `signature` auth AND the address in
 *  x-goldfinch-address must be in the `signerAllowList`
 *
 * none
 *  No auth required
 *
 * IMPORTANT
 * Functions using `signature` or `signatureWithAllowList` verification SHOULD
 * check that the plaintext in the verification result matches the expected
 * plaintext (the expected plaintext is decided by the function). This check is
 * necessary to prevent arbitrary signature re-use. The following example illustrates
 * what is possible if the signature is NOT checked in /kycStatus:
 * 1. Alice signs a message for a meta txn on OpenSea. The txn and signature are broadcast on the network.
 * 2. Bob copies Alice's meta txn signature and prehash of the presigned message (i.e. plaintext) for that signature.
 * 3. Bob sends a request to /kycStatus with x-goldfinch-signature set as Alice's meta txn signature and
 *    x-goldfinch-signature-plaintext to be the plaintext for that signature.
 * 4. Using "signature" auth, the signature and plaintext are verified as a message that was signed by Alice.
 * 5. /kycStatus performs no further checks on the signature and returns Alice's kyc status to Bob.
 */

export type RequestHandlerConfig =
  | {
      requireAuth: "signature"
      signatureMaxAge: number // Age in seconds after which the signature becomes invalid
      fallbackOnMissingPlaintext: boolean
      cors: boolean
      handler: (
        req: Request,
        res: Response,
        signatureVerificationResult: SignatureVerificationSuccessResult,
      ) => Promise<Response>
    }
  | {
      requireAuth: "signatureWithAllowList"
      signatureMaxAge: number // Age in seconds after which the signature becomes invalid
      fallbackOnMissingPlaintext: boolean
      signerAllowList: Array<string>
      cors: boolean
      handler: (
        req: Request,
        res: Response,
        signatureVerificationResult: SignatureVerificationSuccessResult,
      ) => Promise<Response>
    }
  | {
      requireAuth: "none"
      cors: boolean
      handler: (req: Request, res: Response) => Promise<Response>
    }

export type SignatureVerificationFailureResult = {
  res: Response
  address: undefined
}
export type SignatureVerificationSuccessResult = {
  res: undefined
  address: string
  plaintext: string
}
export type SignatureVerificationResult = SignatureVerificationFailureResult | SignatureVerificationSuccessResult

export enum KycProvider {
  Persona = "persona",
  ParallelMarkets = "parallelMarkets",
  None = "none",
}

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
 */

export type RequestHandlerConfig =
  | {
      requireAuth: "signature"
      cors: boolean
      handler: (
        req: Request,
        res: Response,
        signatureVerificationResult: SignatureVerificationSuccessResult,
      ) => Promise<Response>
    }
  | {
      requireAuth: "signatureWithAllowList"
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
}
export type SignatureVerificationResult = SignatureVerificationFailureResult | SignatureVerificationSuccessResult

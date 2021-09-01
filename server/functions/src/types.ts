import { Request, Response } from "@sentry/serverless/dist/gcpfunction/general"

export type RequestHandlerConfig =
  | {
      requireAuth: true
      cors: boolean
      handler: (
        req: Request,
        res: Response,
        signatureVerificationResult: SignatureVerificationSuccessResult,
      ) => Promise<Response>
    }
  | {
      requireAuth: false
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

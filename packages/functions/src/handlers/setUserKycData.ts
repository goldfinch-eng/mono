import * as Sentry from "@sentry/serverless"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getUsers} from "../db/db"
import {extractHeaderValue, genRequestHandler} from "../helpers"
import {SignatureVerificationSuccessResult} from "../types"

// Called as the first step in the Persona KYC flow
export const setUserKYCData = genRequestHandler({
  requireAuth: "signature",
  cors: true,
  signatureMaxAge: 60 * 5, // 5 minutes
  fallbackOnMissingPlaintext: true,
  handler: async (req, res: Response, verificationResult: SignatureVerificationSuccessResult): Promise<Response> => {
    // Verify plaintext matches expected plaintext to prevent the use of an arbitrary signature
    const blockNum = extractHeaderValue(req, "x-goldfinch-signature-block-num")
    const expectedPlaintext = `Sign in to Goldfinch: ${blockNum}`
    if (verificationResult.plaintext !== expectedPlaintext) {
      return res.status(401).send({error: "Unexpected signature"})
    }

    const address = verificationResult.address.toLowerCase()

    Sentry.setUser({id: verificationResult.address})

    const {residency} = req.body

    if (!residency) {
      return res.status(403).send({error: "Invalid KYC details"})
    }

    const users = getUsers()
    const userRef = users.doc(`${address}`)

    await userRef.set(
      {
        address: address,
        updatedAt: Date.now(),
        kycProvider: "persona",
        kyc: {
          residency,
        },
      },
      {
        merge: true,
      },
    )

    return res.status(200).send({status: "success"})
  },
})

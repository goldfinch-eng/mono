import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getUsers} from "../db"
import {genRequestHandler} from "../helpers"
import {SignatureVerificationSuccessResult} from "../types"
import * as admin from "firebase-admin"

export const setUserKYCData = genRequestHandler({
  requireAuth: "signature",
  cors: true,
  handler: async (req, res: Response, verificationResult: SignatureVerificationSuccessResult): Promise<Response> => {
    const address = verificationResult.address.toLowerCase()

    const {residency} = req.body

    if (!residency) {
      return res.status(403).send({error: "Invalid KYC details"})
    }

    const users = getUsers(admin.firestore())
    const userRef = users.doc(`${address}`)

    await userRef.set(
      {
        address: address,
        updatedAt: Date.now(),
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

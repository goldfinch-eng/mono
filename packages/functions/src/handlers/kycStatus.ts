import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getUsers} from "../db"
import {genRequestHandler} from "../helpers"
import {SignatureVerificationSuccessResult} from "../types"
import * as admin from "firebase-admin"

// Top level status transitions should be => pending -> approved | failed -> golisted
// Where:
//  pending: persona verification attempted. Could be in a lot of stages here, persona is the source of truth
//  approved: Approved on persona, but not yet golisted on chain
//  failed: Failed on persona
const userStatusFromPersonaStatus = (personaStatus: string): "unknown" | "approved" | "failed" => {
  // If we don't have a status, or previous attempt expired, treat as a brand new address
  if (personaStatus === "" || personaStatus === undefined || personaStatus === "expired") {
    return "unknown"
  }
  if (personaStatus === "completed" || personaStatus === "approved") {
    return "approved"
  }
  if (personaStatus === "failed" || personaStatus === "declined") {
    return "failed"
  }
  // Treat incomplete applications as unknown for now. In order to resume correctly, we need to
  // generate a resume token via the persona API
  return "unknown"
}

export const kycStatus = genRequestHandler({
  requireAuth: "signature",
  cors: true,
  handler: async (_, res: Response, verificationResult: SignatureVerificationSuccessResult): Promise<Response> => {
    const address = verificationResult.address
    const payload = {address: address, status: "unknown", countryCode: null, residency: ""}

    const users = getUsers(admin.firestore())
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (user.exists) {
      payload.status = userStatusFromPersonaStatus(user.data()?.persona?.status)
      payload.countryCode = user.data()?.countryCode
      payload.residency = user.data()?.kyc?.residency
    }

    return res.status(200).send(payload)
  },
})

import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getUsers} from "../db"
import {extractHeaderValue, genRequestHandler} from "../helpers"
import {SignatureVerificationSuccessResult} from "../types"
import * as admin from "firebase-admin"
import {
  isApprovedNonUSEntity,
  isApprovedUSAccreditedEntity,
  isApprovedUSAccreditedIndividual,
} from "@goldfinch-eng/utils"

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
  signatureMaxAge: 60 * 60 * 24, // 1 day
  fallbackOnMissingPlaintext: true,
  cors: true,
  handler: async (
    req: Request,
    res: Response,
    verificationResult: SignatureVerificationSuccessResult,
  ): Promise<Response> => {
    // Verify plaintext matches expected plaintext to prevent the use of an arbitrary signature
    const blockNum = extractHeaderValue(req, "x-goldfinch-signature-block-num")
    const expectedPlaintext = `Sign in to Goldfinch: ${blockNum}`
    if (verificationResult.plaintext !== expectedPlaintext) {
      return res.status(401).send({error: "Unexpected signature"})
    }

    const address = verificationResult.address
    let payload: any = {address: address, status: "unknown", countryCode: null, residency: ""}

    // Respond with approved if address on any approved list
    if (
      isApprovedNonUSEntity(address) ||
      isApprovedUSAccreditedEntity(address) ||
      isApprovedUSAccreditedIndividual(address)
    ) {
      return res.status(200).send({...payload, status: "approved"})
    }

    const users = getUsers(admin.firestore())
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (user.exists) {
      payload.status = userStatusFromPersonaStatus(user.data()?.persona?.status)
      payload.countryCode = user.data()?.countryCode
      payload.residency = user.data()?.kyc?.residency
    }

    // Mock a parallel markets user response. If both query params are present then
    // any data in the user store is ignored.
    if (req.query.pmIdentityStatus && req.query.pmAccreditationStatus) {
      const pmIdentityStatus = req.query.pmIdentityStatus
      const pmAccreditationStatus = req.query.pmAccreditationStatus
      let status
      if (pmIdentityStatus === "approved" && pmAccreditationStatus === "approved") {
        status = "approved"
      } else if (pmIdentityStatus === "pending" || pmAccreditationStatus === "pending") {
        status = "pending"
      } else {
        status = "failed"
      }
      payload = {
        address,
        status,
        parallelMarkets: {
          identityStatus: pmIdentityStatus,
          accreditationStatus: pmIdentityStatus,
        },
      }
    }

    return res.status(200).send(payload)
  },
})

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
import {ethers} from "ethers"
import {KycAccreditationStatus, KycIdentityStatus, KycStatus} from "./kyc/kycTypes"

// Response shape for a user who was KYC'd through Parallel Markets
interface KycStatusPmResponse {
  address: string
  status: KycStatus
  parallelMarkets: {
    identityStatus: KycIdentityStatus
    accreditationStatus: KycAccreditationStatus
    accessRevocationBy?: number
  }
}

// Response shape for a user who was KYC'd through Persona
interface KycStatusPersonaResponse {
  address: string
  status: KycStatus
  countryCode: string | null
  residency: string | null
}

// Response shape
type KycStatusResponse = KycStatusPmResponse | KycStatusPersonaResponse

// Top level status transitions should be => pending -> approved | failed -> golisted
// Where:
//  pending: persona verification attempted. Could be in a lot of stages here, persona is the source of truth
//  approved: Approved on persona, but not yet golisted on chain
//  failed: Failed on persona
const userStatusFromPersonaStatus = (personaStatus: string): KycStatus => {
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

const userStatusFromPmStatus = (
  identityStatus: KycIdentityStatus,
  accreditationStatus: KycAccreditationStatus,
): KycStatus => {
  if (identityStatus === "approved" && accreditationStatus === "approved") {
    return "approved"
  } else if (identityStatus === "failed" || accreditationStatus === "failed") {
    return "failed"
  } else if (identityStatus === "expired" || accreditationStatus === "expired") {
    return "expired"
  } else if (identityStatus.startsWith("pending") || accreditationStatus.startsWith("pending")) {
    return "pending"
  } else {
    return "unknown"
  }
}

// Construct a Persona response body from a user document
const getPersonaPayload = (data: FirebaseFirestore.DocumentData): KycStatusPersonaResponse => {
  return {
    address: ethers.utils.getAddress(data?.address),
    status: userStatusFromPersonaStatus(data?.persona?.status),
    countryCode: data?.countryCode,
    residency: data?.kyc?.residency,
  }
}

// Construct a Parallel Markets response body from a user document
const getPmPayload = (data: FirebaseFirestore.DocumentData): KycStatusPmResponse => {
  const {parallelMarkets} = data
  const {identityAccessRevocationAt, accreditationAccessRevocationAt} = parallelMarkets
  let accessRevocationBy = undefined
  if (identityAccessRevocationAt && accreditationAccessRevocationAt) {
    accessRevocationBy = Math.min(identityAccessRevocationAt, accreditationAccessRevocationAt)
  }

  return {
    address: ethers.utils.getAddress(data?.address),
    status: userStatusFromPmStatus(data?.parallelMarkets.identityStatus, data?.parallelMarkets.accreditationStatus),
    parallelMarkets: {
      identityStatus: data?.parallelMarkets.identityStatus,
      accreditationStatus: data?.parallelMarkets.accreditationStatus,
      accessRevocationBy,
    },
  }
}

const isLegacyAccreditedUser = (address: string) => {
  const isLegacyProd =
    isApprovedNonUSEntity(address) || isApprovedUSAccreditedEntity(address) || isApprovedUSAccreditedIndividual(address)
  return process.env.NODE_ENV === "test"
    ? isLegacyProd || address === "0xA57415BeCcA125Ee98B04b229A0Af367f4144030" // Fake address used for testing
    : isLegacyProd
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
    let payload: KycStatusResponse = {address: address, status: "unknown", countryCode: null, residency: ""}

    const users = getUsers(admin.firestore())
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (user.exists) {
      const data = user.data()
      if (data?.persona) {
        payload = getPersonaPayload(data)
      } else if (data?.parallelMarkets) {
        payload = getPmPayload(data)
      }
    } else if (isLegacyAccreditedUser(address)) {
      // Automatic approval if they're a legacy accredited user
      return res.status(200).send({
        ...payload,
        status: "approved",
        parallelMarkets: {
          identityStatus: "legacy",
          accreditationStatus: "legacy",
        },
      })
    }

    // Mock a parallel markets user response. If both query params are present then
    // any data in the user store is ignored.
    if (req.query.pmIdentityStatus && req.query.pmAccreditationStatus) {
      const pmIdentityStatus = req.query.pmIdentityStatus as KycIdentityStatus
      const pmAccreditationStatus = req.query.pmAccreditationStatus as KycAccreditationStatus
      payload = {
        address,
        status: userStatusFromPmStatus(pmIdentityStatus, pmAccreditationStatus),
        parallelMarkets: {
          identityStatus: pmIdentityStatus,
          accreditationStatus: pmIdentityStatus,
        },
      }
    }

    return res.status(200).send(payload)
  },
})

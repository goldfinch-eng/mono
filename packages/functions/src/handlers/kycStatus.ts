import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getUsers} from "../db"
import {extractHeaderValue, genRequestHandler} from "../helpers"
import {SignatureVerificationSuccessResult} from "../types"
import {
  isApprovedNonUSEntity,
  isApprovedUSAccreditedEntity,
  isApprovedUSAccreditedIndividual,
  KycAccreditationStatus,
  KycIdentityStatus,
  KycStatus,
  KycStatusResponse,
} from "@goldfinch-eng/utils"
import {ethers} from "ethers"

// Top level status transitions should be => pending -> approved | failed -> golisted
// Where:
//  pending: persona verification attempted. Could be in a lot of stages here, persona is the source of truth
//  approved: Approved on persona, but not yet golisted on chain
//  failed: Failed on persona
const topLevelStatusFromPersonaStatus = (personaStatus: string): KycStatus => {
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
  } else if (identityStatus === "approved" && accreditationStatus === "unaccredited") {
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
const getPersonaStatusResponse = (data: FirebaseFirestore.DocumentData): KycStatusResponse => {
  const topLevelStatus = topLevelStatusFromPersonaStatus(data?.persona?.status)
  return {
    address: ethers.utils.getAddress(data?.address),
    status: topLevelStatus,
    countryCode: data?.countryCode || "unknown",
    residency: data?.kyc?.residency || "unknown",
    kycProvider: "persona",
    type: "individual",
    accreditationStatus: "unaccredited",
    identityStatus: topLevelStatus as KycIdentityStatus,
  }
}

// Construct a Parallel Markets response body from a user document
const getPmStatusResponse = (data: FirebaseFirestore.DocumentData): KycStatusResponse => {
  const {countryCode, residency, parallelMarkets} = data
  const {identityAccessRevocationAt, accreditationAccessRevocationAt} = parallelMarkets
  let accessRevocationBy = undefined
  if (identityAccessRevocationAt && accreditationAccessRevocationAt) {
    accessRevocationBy = Math.min(identityAccessRevocationAt, accreditationAccessRevocationAt)
  }

  return {
    address: ethers.utils.getAddress(data?.address),
    status: userStatusFromPmStatus(data?.parallelMarkets.identityStatus, data?.parallelMarkets.accreditationStatus),
    kycProvider: "parallelMarkets",
    countryCode,
    residency,
    type: data?.parallelMarkets.type,
    identityStatus: data?.parallelMarkets.identityStatus,
    accreditationStatus: data?.parallelMarkets.accreditationStatus,
    accessRevocationBy,
  }
}

const getLegacyPayload = (address: string): KycStatusResponse => {
  const payload: KycStatusResponse = {
    address,
    status: "approved",
    countryCode: "unknown",
    residency: "unknown",
    kycProvider: "parallelMarkets",
    type: "individual",
    identityStatus: "legacy",
    accreditationStatus: "legacy",
  }

  if (isApprovedNonUSEntity(address)) {
    payload.countryCode = "nonUs"
    payload.residency = "nonUs"
    payload.type = "business"
  } else if (isApprovedUSAccreditedEntity(address)) {
    payload.countryCode = "US"
    payload.residency = "us"
    payload.type = "business"
  } else if (isApprovedUSAccreditedIndividual(address)) {
    payload.countryCode = "US"
    payload.residency = "us"
    payload.type = "individual"
  } else if (process.env.NODE_ENV === "test" && address === "0xA57415BeCcA125Ee98B04b229A0Af367f4144030") {
    // Fake address used for testing
    payload.countryCode = "US"
    payload.residency = "us"
    payload.type = "individual"
  } else {
    throw new Error(`${address} is not legacy`)
  }

  return payload
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
    let payload: KycStatusResponse = {
      address: address,
      status: "unknown",
      countryCode: "unknown",
      residency: "unknown",
      kycProvider: "none",
    }

    const users = getUsers()
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (user.exists) {
      console.log(`Found user in store for address ${address.toLowerCase()}`)
      const data = user.data()
      if (data?.persona) {
        console.log("User is persona user")
        payload = getPersonaStatusResponse(data)
      } else if (data?.parallelMarkets) {
        console.log("User is parallelMarkets user")
        payload = getPmStatusResponse(data)
      }
    } else if (isLegacyAccreditedUser(address)) {
      console.log(`Found user in legacy json lists for address ${address.toLowerCase()}`)
      payload = getLegacyPayload(address)
    }

    console.log("Payload to return is")
    console.log(payload)

    // Mock a parallel markets user response. If both query params are present then
    // any data in the user store is ignored.
    // TODO - remove after sufficient testing
    if (req.query.pmIdentityStatus && req.query.pmAccreditationStatus) {
      console.log("Overriding payload based on request query params")
      const pmIdentityStatus = req.query.pmIdentityStatus as KycIdentityStatus
      const pmAccreditationStatus = req.query.pmAccreditationStatus as KycAccreditationStatus
      payload = {
        address,
        status: userStatusFromPmStatus(pmIdentityStatus, pmAccreditationStatus),
        countryCode: "US",
        residency: "us",
        kycProvider: "parallelMarkets",
        type: "individual",
        identityStatus: pmIdentityStatus,
        accreditationStatus: pmIdentityStatus,
      }
    }

    return res.status(200).send(payload)
  },
})

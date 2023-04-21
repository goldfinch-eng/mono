import * as Sentry from "@sentry/serverless"
import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getDb, getUsers} from "../db"
import {genRequestHandler} from "../helpers"
import {KycProvider, SignatureVerificationSuccessResult} from "../types"
import * as admin from "firebase-admin"
import {ParallelMarkets} from "./parallelmarkets/PmApi"
import firestore = admin.firestore
import {KycItemParallelMarkets, KycItem} from "./kyc/kycTypes"
import {
  getAccreditationStatus,
  getBusinessIdentityStatus,
  getIndividualIdentityStatus,
} from "./kyc/parallelMarketsConverter"

export const registerKyc = genRequestHandler({
  requireAuth: "signature",
  signatureMaxAge: 60 * 60 * 24, // 1 day
  fallbackOnMissingPlaintext: false,
  cors: true,
  handler: async (
    req: Request,
    res: Response,
    verificationResult: SignatureVerificationSuccessResult,
  ): Promise<Response> => {
    const {plaintext} = verificationResult
    const address = verificationResult.address.toLowerCase()

    Sentry.setUser({id: address, address})

    const expectedPlaintextPrefixLength = "Share your OAuth code with Goldfinch: ".length
    const key = plaintext.slice(expectedPlaintextPrefixLength)

    if (!key) return res.status(400).send({error: "Missing key"})

    // TODO - make parallel_markets camel case. Requires client changes
    // TODO - can we consolidate /registerKyc and /setUserKycData?
    //        They do very similar things, just different providers
    try {
      const data = await getParalleMarketsUser(key)
      console.log("Saving data to store")
      console.log(data)
      await saveParallelMarketsUser(address, data)
    } catch (e) {
      console.error(e)
      return res.status(500).send({status: "failed to save parallel markets data"})
    }

    return res.status(200).send({status: "success"})
  },
})

type ParallelMarketsUserData = {
  id: string
  countryCode: string
  type: "business" | "individual"
  accreditationStatus?: string
  identityStatus?: string
  accreditationExpiresAt?: number
  identityExpiresAt?: number
}

const getParalleMarketsUser = async (authCode: string): Promise<ParallelMarketsUserData> => {
  const {accessToken} = await ParallelMarkets.tradeCodeForToken(authCode)

  console.log({accessToken})

  const [identity, accreditation] = await Promise.all([
    ParallelMarkets.getIdentityForAccessToken(accessToken),
    ParallelMarkets.getAccreditationsForAccessToken(accessToken),
  ])

  const {id, type, identityDetails} = identity
  const {type: accreditationType} = accreditation

  if (type === "business" && accreditationType === "business") {
    const {incorporationCountry, principalLocation, consistencySummary, expiresAt} = identityDetails
    const identityExpiresAt = expiresAt ? Date.parse(expiresAt) / 1000 : undefined
    const countryIsUS = incorporationCountry === "US" || principalLocation.country == "US"

    const {status: accreditationStatus, expiresAt: accreditationExpiresAt} = getAccreditationStatus(accreditation)

    const businessIdentityStatus = getBusinessIdentityStatus(consistencySummary.overallRecordsMatchLevel)

    return {
      id,
      // We should use the logic in the webhook helper here
      type: "business",
      accreditationStatus,
      accreditationExpiresAt,
      identityStatus: businessIdentityStatus,
      identityExpiresAt,
      countryCode: countryIsUS ? "US" : incorporationCountry,
    }
  }

  if (type === "individual" && accreditationType === "individual") {
    const {citizenshipCountry, residenceLocation, consistencySummary, expiresAt} = identityDetails
    const identityExpiresAt = expiresAt ? Date.parse(expiresAt) / 1000 : undefined
    const countryIsUS = citizenshipCountry === "US" || residenceLocation.country == "US"

    const {status: accreditationStatus, expiresAt: accreditationExpiresAt} = getAccreditationStatus(accreditation)

    const {overallRecordsMatchLevel, idValidity} = consistencySummary
    const individualIdentityStatus = getIndividualIdentityStatus(overallRecordsMatchLevel, idValidity)

    return {
      id,
      type: "individual",
      accreditationStatus,
      accreditationExpiresAt,
      identityStatus: individualIdentityStatus,
      identityExpiresAt,
      countryCode: countryIsUS ? "US" : citizenshipCountry,
    }
  }

  throw new Error(`Unexpected identity and accreditation types: '${type}' / '${accreditationType}'`)
}

const saveParallelMarketsUser = async (
  address: string,
  {
    id,
    accreditationStatus,
    identityStatus,
    accreditationExpiresAt,
    identityExpiresAt,
    countryCode,
    type,
  }: ParallelMarketsUserData,
) => {
  const db = getDb()
  const userRef = getUsers().doc(`${address.toLowerCase()}`)

  await db.runTransaction(async (t: firestore.Transaction) => {
    const doc = await t.get(userRef)

    if (doc.exists) {
      console.log(`User exists for address ${address} - merging`)
      const existingData = doc.data() as KycItem

      if (existingData.persona && existingData.persona.status === "approved") {
        throw new Error(`User ${address} has already passed kyc'd through Persona`)
      }

      t.update(userRef, {
        parallelMarkets: {
          ...(existingData || {}).parallelMarkets,
          id,
          accreditationStatus: accreditationStatus || null,
          accreditationAccessRevocationAt: null,
          accreditationExpiresAt: accreditationExpiresAt || null,
          identityStatus: identityStatus || null,
          identityAccessRevocationAt: null,
          identityExpiresAt: identityExpiresAt || null,
        },
        countryCode: countryCode || null,
        updatedAt: Date.now(),
      } as KycItemParallelMarkets)
    } else {
      console.log(`User doesn't exist for address ${address} - setting`)
      t.set(userRef, {
        address: address,
        parallelMarkets: {
          id,
          type,
          accreditationStatus: accreditationStatus || null,
          accreditationAccessRevocationAt: null,
          accreditationExpiresAt: accreditationExpiresAt || null,
          identityStatus: identityStatus || null,
          identityAccessRevocationAt: null,
          identityExpiresAt: identityExpiresAt || null,
        },
        kycProvider: KycProvider.ParallelMarkets.valueOf(),
        countryCode: countryCode || null,
        updatedAt: Date.now(),
      } as KycItemParallelMarkets)
    }
  })
}

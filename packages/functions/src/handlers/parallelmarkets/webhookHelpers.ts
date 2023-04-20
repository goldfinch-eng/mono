/* eslint-disable camelcase */
import {assertUnreachable} from "@goldfinch-eng/utils"
import {ParallelMarkets} from "./PmApi"
import {
  PmAccreditationPayload,
  PmBusinessIdentity,
  PmEntity,
  PmIdentityPayload,
  PmIndividualIdentity,
} from "./PmApiTypes"
import {getUsers} from "../../db"
import {FieldPath} from "@google-cloud/firestore"
import {
  getAccreditationStatus,
  getBusinessIdentityStatus,
  getIndividualIdentityStatus,
} from "../kyc/parallelMarketsConverter"

export const processIdentityWebhook = async (payload: PmIdentityPayload) => {
  const {event, entity} = payload
  switch (event) {
    case "data_update":
      await processIdentityDataUpdate(entity)
      break
    case "access_revocation_scheduled":
      await processIdentityRevocationScheduled(entity)
      break
    default:
      // There are some other event's for identity but we don't care about them. For a full list see
      // https://developer.parallelmarkets.com/docs/webhooks/request-format#identity
      break
  }
}

export const processAccreditationWebhook = async (payload: PmAccreditationPayload) => {
  const {event, entity} = payload
  switch (event) {
    case "data_update":
      await processAccreditationDataUpdate(entity)
      break
    case "access_revocation_scheduled":
      await processAccreditationRevocationScheduled(entity)
      break
    default:
      // According to PM docs, there are no other values for event, so we should error if we see an
      // unexpected one: https://developer.parallelmarkets.com/docs/webhooks/request-format#accreditation-status
      assertUnreachable(event)
  }
}

const processIdentityDataUpdate = async ({id, type}: PmEntity) => {
  console.log(`Processing identity data update for (${id}, ${type})`)
  const identity = await ParallelMarkets.getIdentity(id)

  console.log(`Fetched PM Identity for ${id}`)
  console.log(identity)

  switch (identity.type) {
    case "individual":
      await processIndividualIdentityDataUpdate(identity)
      break
    case "business":
      await processBusinessIdentityDataUpdate(identity)
      break
    default:
      break
  }
}

const processAccreditationDataUpdate = async ({id, type}: PmEntity) => {
  console.log(`Processing accreditation data update for (${id}, ${type})`)
  const accreditation = await ParallelMarkets.getAccreditations(id)

  console.log(`Fetched PM Accreditation for ${id}`)
  console.log(accreditation)

  if (!(accreditation.type === "individual" || accreditation.type === "business")) {
    // TODO - useful error message
    return
  }

  const {status: accreditationStatus, expiresAt} = getAccreditationStatus(accreditation)
  console.log(`accreditationStatus=${accreditationStatus}, expiresAt=${expiresAt || "none"}`)

  const user = await getUserDocByPMId(accreditation.id)

  if (!user) {
    return
  }

  console.log(`Found user for PM id ${accreditation.id}`)
  console.log(user.data())

  const userRef = getUsers().doc(user.data()?.address)
  const accreditationExpiresAt = expiresAt
  const dataToMerge = {
    parallelMarkets: {
      accreditationStatus,
      ...(!!accreditationExpiresAt && {accreditationExpiresAt}),
    },
  }
  console.log("data to merge")
  console.log(dataToMerge)
  await userRef.set(dataToMerge, {merge: true})
}

const processIndividualIdentityDataUpdate = async ({id, identityDetails}: PmIndividualIdentity) => {
  console.log("Processing individual identity data update")
  const {consistencySummary, citizenshipCountry, residenceLocation, expiresAt} = identityDetails
  const {overallRecordsMatchLevel, idValidity} = consistencySummary

  const identityStatus = getIndividualIdentityStatus(overallRecordsMatchLevel, idValidity)
  console.log(`The individual identity status is ${identityStatus}`)

  const user = await getUserDocByPMId(id)

  if (!user) {
    return
  }

  console.log(`Found user for PM id ${id}`)
  console.log(user.data())

  // Overwrite the parallelMarkets.identity_status key
  console.log("overwriting user with data")
  const userRef = getUsers().doc(user.data()?.address)
  const identityExpiresAt = expiresAt ? Date.parse(expiresAt) / 1000 : undefined
  const dataToMerge = {
    countryCode: citizenshipCountry,
    residency: residenceLocation.country.toLowerCase(),
    parallelMarkets: {
      identityStatus,
      ...(!!identityExpiresAt && {identityExpiresAt}),
    },
  }
  await userRef.set(dataToMerge, {merge: true})
}

const processBusinessIdentityDataUpdate = async ({id, identityDetails}: PmBusinessIdentity) => {
  console.log("Processing business identity data update")
  const {consistencySummary, principalLocation} = identityDetails
  const {overallRecordsMatchLevel} = consistencySummary

  const identityStatus = getBusinessIdentityStatus(overallRecordsMatchLevel)
  console.log(`The business identity status is ${identityStatus}`)

  const user = await getUserDocByPMId(id)

  if (!user) {
    return
  }

  console.log(`Found user for PM id ${id}`)
  console.log(user.data())

  // Overwrite the parallelMarkets.identity_status key
  const userRef = getUsers().doc(user.data()?.address)
  const dataToMerge = {
    countryCode: principalLocation.country,
    residency: principalLocation.country.toLowerCase(),
    parallelMarkets: {
      identityStatus,
    },
  }
  console.log("data to merge")
  console.log(dataToMerge)
  await userRef.set(dataToMerge, {merge: true})
}

const processIdentityRevocationScheduled = async ({id, type}: PmEntity) => {
  console.log(`Processing identity access revocation for (${id}, ${type}`)

  // Call the Profiles API to determine the timestamp when access will be revoked
  const profile = await ParallelMarkets.getProfile(id)
  if (profile.accessExpiresAt) {
    const expiresAtUnixTimestamp = Date.parse(profile.accessExpiresAt) / 1000
    // Write timestamp to user
    const user = await getUserDocByPMId(id)
    if (!user) {
      return
    }
    console.log(`Found user for PM id ${id}`)
    console.log(user.data())

    const userRef = getUsers().doc(user.data()?.address)
    const dataToMerge = {
      parallelMarkets: {
        identityAccessRevocationAt: expiresAtUnixTimestamp,
      },
    }
    console.log("Merging data")
    console.log(dataToMerge)
    await userRef.set(dataToMerge, {merge: true})
  }
}

const processAccreditationRevocationScheduled = async ({id, type}: PmEntity) => {
  console.log(`Processing accreditation access revocation for (${id}, ${type})`)

  // Call the Profiles API to determine the timestamp when access will be revoked
  const profile = await ParallelMarkets.getProfile(id)
  if (profile.accessExpiresAt) {
    const expiresAtUnixTimestamp = Date.parse(profile.accessExpiresAt) / 1000
    // Write timestamp to user
    const user = await getUserDocByPMId(id)
    if (!user) {
      return
    }
    console.log(`Found user for PM id ${id}`)
    console.log(user.data())

    const userRef = getUsers().doc(user.data()?.address)
    const dataToMerge = {
      parallelMarkets: {
        accreditationAccessRevocationAt: expiresAtUnixTimestamp,
      },
    }
    console.log("Merging data")
    console.log(dataToMerge)
    await userRef.set(dataToMerge, {merge: true})
  }
}

const getUserDocByPMId = async (id: string) => {
  const users = getUsers()
  const fieldPath = new FieldPath("parallelMarkets", "id")
  const userSnapshot = await users.where(fieldPath, "==", id).get()
  if (userSnapshot.empty) {
    console.log("user not found")
    return undefined
  } else if (userSnapshot.size > 1) {
    console.error("Found multiple useres for the same id")
    return undefined
  }

  console.log("found user... returning")
  return userSnapshot.docs.at(0)
}

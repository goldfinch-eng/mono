import {ParallelMarkets} from "./PmApi"
import {
  PmAccreditationPayload,
  PmBusinessIdentity,
  PmEntity,
  PmIdentityPayload,
  PmIndividualIdentity,
} from "./PmApiTypes"
import {getUsers} from "../../db/db"
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
    // There are some other event's for identity but we don't care about them. For a full list see
    // https://developer.parallelmarkets.com/docs/webhooks/request-format#identity
    case "adverse_media_risk_monitor_match":
    case "currently_sanctioned_risk_monitor_match":
    case "disqualified_director_risk_monitor_match":
    case "financial_regulator_risk_monitor_match":
    case "insolvent_risk_monitor_match":
    case "law_enforcement_risk_monitor_match":
    case "pep_risk_monitor_match":
      console.log(`Ignoring event ${event}`)
      break
    // If we're here then we've received an undocumented event
    default:
      console.error(`Ignoring unexpected event ${event}`)
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
      // According to PM docs, there are no other values for event, so reaching this code path is
      // unexpected: https://developer.parallelmarkets.com/docs/webhooks/request-format#accreditation-status
      console.error(`Ignoring unexpected event ${event}`)
  }
}

const processIdentityDataUpdate = async ({id, type}: PmEntity) => {
  console.log(`Processing identity data update for (${id}, ${type})`)
  const identity = await ParallelMarkets.getIdentity(id)
  console.log(`Fetched PM Identity for ${id}`)

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

  const {type: accreditationType} = accreditation
  if (accreditationType !== "individual" && accreditationType !== "business") {
    throw new Error(`Unexpected accreditation type: ${accreditationType}`)
  }

  const {status: accreditationStatus, expiresAt} = getAccreditationStatus(accreditation)
  console.log(`accreditationStatus=${accreditationStatus}, expiresAt=${expiresAt || "none"}`)

  const user = await getUserDocByPMId(accreditation.id)

  if (!user) {
    return
  }

  console.log(`Found user for PM id ${accreditation.id}`)

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
  console.log(`Processing individual identity data update for ${id}`)
  const {consistencySummary, citizenshipCountry, residenceLocation, expiresAt} = identityDetails
  const {overallRecordsMatchLevel, idValidity} = consistencySummary

  const identityStatus = getIndividualIdentityStatus(overallRecordsMatchLevel, idValidity)
  console.log(`Computed new individual identity status=${identityStatus}`)

  const user = await getUserDocByPMId(id)

  if (!user) {
    return
  }

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
  console.log("Merging data into user document:")
  console.log(dataToMerge)
  await userRef.set(dataToMerge, {merge: true})
}

const processBusinessIdentityDataUpdate = async ({id, identityDetails}: PmBusinessIdentity) => {
  console.log(`Processing business identity data update for ${id}`)
  const {consistencySummary, principalLocation} = identityDetails
  const {overallRecordsMatchLevel} = consistencySummary

  const identityStatus = getBusinessIdentityStatus(overallRecordsMatchLevel)
  console.log(`Computed new business identity status=${identityStatus}`)

  const user = await getUserDocByPMId(id)

  if (!user) {
    return
  }

  // Overwrite the parallelMarkets.identity_status key
  const userRef = getUsers().doc(user.data()?.address)
  const dataToMerge = {
    countryCode: principalLocation.country,
    residency: principalLocation.country.toLowerCase(),
    parallelMarkets: {
      identityStatus,
    },
  }
  console.log("Merging data into user document:")
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

    const userRef = getUsers().doc(user.data()?.address)
    const dataToMerge = {
      parallelMarkets: {
        identityAccessRevocationAt: expiresAtUnixTimestamp,
      },
    }
    console.log("Merging data into user document:")
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

    const userRef = getUsers().doc(user.data()?.address)
    const dataToMerge = {
      parallelMarkets: {
        accreditationAccessRevocationAt: expiresAtUnixTimestamp,
      },
    }
    console.log("Merging data into user document:")
    console.log(dataToMerge)
    await userRef.set(dataToMerge, {merge: true})
  }
}

/**
 * Search for a user in the users store by their Parallel Markets id
 * @param {string} id
 * @return {Object | undefined} the DocumentData object of the user if found, undefined otherwise
 */
export const getUserDocByPMId = async (id: string) => {
  const users = getUsers()
  const userSnapshot = await users.where("parallelMarkets.id", "==", id).get()
  if (userSnapshot.empty) {
    console.log(`User ${id} not found`)
    return undefined
  } else if (userSnapshot.size > 1) {
    throw new Error(`Found multiple users with id=${id}`)
  }

  console.log(`User ${id} found`)
  return userSnapshot.docs.at(0)
}

/* eslint-disable camelcase */
import {assertUnreachable} from "@goldfinch-eng/utils"
import {fetchIdentity} from "./apiHelpers"
import {
  ConsistencyLevel,
  IdentityDocumentValidity,
  PmAccreditationPayload,
  PmBusinessIdentity,
  PmEntity,
  PmIdentityPayload,
  PmIndividualIdentity,
} from "./types"
import {getUsers} from "../../db"
import * as admin from "firebase-admin"
import {FieldPath} from "@google-cloud/firestore"

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
  const identity = await fetchIdentity(id)

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
      // TODO - how to handle the default case?
      break
  }
}

const processIndividualIdentityDataUpdate = async ({id, identity_details}: PmIndividualIdentity) => {
  const {consistency_summary} = identity_details
  const {overall_records_level_match, id_validity} = consistency_summary

  const identityStatus = getIdentityStatus(overall_records_level_match, id_validity)

  const user = await getUserDocByPMId(id)
  if (!user) {
    console.log(`User not found for PM id ${id}`)
    return
  }

  console.log(`Found user for PM id ${id}`)
  console.log(user.data())
  // Overwrite the parallel_markets.identity_status key
  const userRef = getUsers(admin.firestore()).doc(user.data()?.address)
  await userRef.set(
    {
      parallel_markets: {
        identity_status: identityStatus,
      },
    },
    {
      merge: true,
    },
  )
}

const processBusinessIdentityDataUpdate = async ({identity_details}: PmBusinessIdentity) => {
  console.log("Processing business identity data update")
}

const processIdentityRevocationScheduled = async ({id, type}: PmEntity) => {
  console.log(`Processing identity access revocation for (${id}, ${type}`)
}

const processAccreditationDataUpdate = async ({id, type}: PmEntity) => {
  console.log(`Processing accreditation data update for (${id}, ${type})`)
}

const processAccreditationRevocationScheduled = async ({id, type}: PmEntity) => {
  console.log(`Processing accreditation access revocation for (${id}, ${type})`)
}

const getIdentityStatus = (overallRecordsLevelMatch: ConsistencyLevel, idValidity: IdentityDocumentValidity | null) => {
  // TODO - automatically set legacy users to approved
  if (idValidity === null) {
    // We're still waiting for them to submit their identity documents
    return "pending"
  } else if (idValidity === "expired") {
    return "documents_expired"
  } else if (idValidity === "valid" && overallRecordsLevelMatch === "high") {
    return "approved"
  } else {
    // In this case either the id is not valid or the records level match is not strong.
    // We consider this a failure
    return "failed"
  }
}

const getUserDocByPMId = async (id: string) => {
  const users = getUsers(admin.firestore())
  const fieldPath = new FieldPath("parallel_markets", "id")
  const userSnapshot = await users.where(fieldPath, "==", id).get()
  if (userSnapshot.empty) {
    console.log("user not found")
    return undefined
  } else if (userSnapshot.size > 1) {
    console.error("Found multiple useres for the same id")
    return undefined
  }

  return userSnapshot.docs.at(0)
}

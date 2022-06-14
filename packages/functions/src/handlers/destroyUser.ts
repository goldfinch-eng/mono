import * as Sentry from "@sentry/serverless"
import * as admin from "firebase-admin"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {getDb, getDestroyedUsers, getUsers} from "../db"
import {genRequestHandler} from "../helpers"
import firestore = admin.firestore

// This is the address of the Unique Identity Signer, a relayer on
// Defender. It has the SIGNER_ROLE on UniqueIdentity and therefore
// is able to authorize a burn.
const UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS = "0x125cde169191c6c6c5e71c4a814bb7f7b8ee2e3f"

// This is an address for which we have a valid signature, used for
// unit testing
const UNIT_TESTING_SIGNER = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"

/**
 * Throw when the destroyUser function is called on a user whose persona status is
 * NOT "approved". Users can only be deleted after they have been approved.
 */
class InvalidPersonaStatusError extends Error {
  // eslint-disable-next-line require-jsdoc
  constructor(message: string) {
    super(message)
  }
}

export const destroyUser = genRequestHandler({
  requireAuth: "signatureWithAllowList",
  signerAllowList:
    process.env.NODE_ENV === "test"
      ? [UNIT_TESTING_SIGNER, UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS]
      : [UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS],
  cors: false,
  handler: async (req, res): Promise<Response> => {
    console.log("destroyUser start")

    const addressToDestroy = req.body.addressToDestroy
    const burnedUidType = req.body.burnedUidType
    console.log(`Recording UID burn of type ${burnedUidType} for address ${addressToDestroy}`)

    assertNonNullable(addressToDestroy)
    assertNonNullable(burnedUidType)

    // Having verified the request, we can set the Sentry user context accordingly.
    Sentry.setUser({id: addressToDestroy})

    const db = getDb(admin.firestore())
    const userRef = getUsers(admin.firestore()).doc(`${addressToDestroy.toLowerCase()}`)
    const destroyedUserRef = getDestroyedUsers(admin.firestore()).doc(`${addressToDestroy.toLowerCase()}`)

    try {
      // The firestore web SDK uses optimistic locking for rows involved in a transaction so we don't have
      // to worry about corrupted writes. The transaction keeps track of the documents read inside the
      // transaction and performs the write if and only if none of those documents changed during the
      // transaction's execution. See https://firebase.google.com/docs/firestore/transaction-data-contention
      // for more info.
      await db.runTransaction(async (t: firestore.Transaction) => {
        const user = await userRef.get()
        if (!user.exists) {
          console.log(`no entry found for ${addressToDestroy} in 'users' store`)
          return
        }

        const personaData = user.data()?.persona

        // The only valid use of this function is to delete a user who was already approved by persona
        // and minted a UID. If their status is not approved then something's wrong here.
        if (personaData.status !== "approved") {
          throw new InvalidPersonaStatusError("Can only delete users with 'approved' status")
        }

        t.delete(userRef)

        // Build document data for destroyedUsers entry
        const newDeletion = {
          countryCode: user.data()?.countryCode,
          burnedUidType,
          persona: {
            id: personaData.id,
            status: personaData.status,
          },
          deletedAt: Date.now(),
        }

        console.log("Deletion data to insert/append:")
        console.log(newDeletion)

        // The deletion is stored in an array. Each new deletion appends to the array,
        // and allows us to track an arbitrary number of deletions for an address.
        const destroyedUser = await destroyedUserRef.get()
        if (destroyedUser.exists) {
          console.log("destroyedUser ref exists... appending to document")
          const deletions = [...destroyedUser.data()?.deletions, newDeletion]
          const updatedDocument = {
            address: addressToDestroy,
            deletions,
          }
          t.update(destroyedUserRef, updatedDocument)
        } else {
          console.log("destroyedUser ref does not exist... creating document")
          const deletions = [newDeletion]
          const updatedDocument = {
            address: addressToDestroy,
            deletions,
          }
          t.create(destroyedUserRef, updatedDocument)
        }
      })
    } catch (e) {
      console.error(e)
      let errorStatus = 500
      if (e instanceof InvalidPersonaStatusError) {
        errorStatus = 409
      }
      return res.status(errorStatus).send({status: "error", message: (e as Error).message})
    }

    console.log("destroyUser end")
    return res.status(200).send({status: "success"})
  },
})

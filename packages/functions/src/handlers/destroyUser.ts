import * as Sentry from "@sentry/serverless"
import * as admin from "firebase-admin"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getDb, getDestroyedUsers, getUsers} from "../db/db"
import {genRequestHandler} from "../helpers"
import {ethers} from "ethers"
import firestore = admin.firestore

// This is the address of the Unique Identity Signer, a relayer on
// Defender. It has the SIGNER_ROLE on UniqueIdentity and therefore
// is able to authorize a burn.
import {UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS, validateUidType} from "@goldfinch-eng/utils"

// This is an address for which we have a valid signature, used for
// unit testing
const UNIT_TESTING_SIGNER = "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F"

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

type DecodedPlaintext = {
  addressToDestroy: string
  burnedUidType: number
}

/**
 * Parse the encoded plaintext. It's expected to be an address (addressToBurn) and uint8
 * (burnedUidType) encoded via defaultAbiCode.encode(...)
 * @param {string} message the abi encoded plaintext
 * @return {DecodedPlaintext} decoded plaintext
 */
const parsePlaintext = (message: string): DecodedPlaintext => {
  console.log(`Decoding plaintext ${message}`)
  const [addressToDestroy, burnedUidType] = ethers.utils.defaultAbiCoder.decode(["address", "uint8"], message, false)
  validateUidType(burnedUidType)
  return {
    addressToDestroy,
    burnedUidType,
  }
}

export const destroyUser = genRequestHandler({
  requireAuth: "signatureWithAllowList",
  signatureMaxAge: 60 * 5, // 5 minutes
  fallbackOnMissingPlaintext: false,
  signerAllowList:
    process.env.NODE_ENV === "test"
      ? [UNIT_TESTING_SIGNER, UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS]
      : [UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS],
  cors: false,
  handler: async (_, res, verificationResult): Promise<Response> => {
    let addressToDestroy: string
    let burnedUidType: number
    try {
      ;({addressToDestroy, burnedUidType} = parsePlaintext(verificationResult.plaintext))
    } catch (e) {
      console.error(e)
      return res.status(400).send({status: "error", message: "Bad plaintext"})
    }

    // Having verified the request, we can set the Sentry user context accordingly.
    Sentry.setUser({id: addressToDestroy})

    console.log(`Recording UID burn of type ${burnedUidType} for address ${addressToDestroy}`)

    const db = getDb()
    const userRef = getUsers().doc(`${addressToDestroy.toLowerCase()}`)
    const destroyedUserRef = getDestroyedUsers().doc(`${addressToDestroy.toLowerCase()}`)

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

        const userData = user.data()
        if (!userData) {
          throw new Error(`User data for ${addressToDestroy} was blank`)
        }

        if (userData.kycProvider === "parallelMarkets") {
          // This function isn't setup to delete users who were KYC'd by Parallel Markets
          throw new Error("Cannot delete users who were KYC'd by Parallel Markets")
        }

        const personaData = userData.persona

        // The only valid use of this function is to delete a user who was already approved by persona
        // and minted a UID. If their status is not approved then something's wrong here.
        if (personaData.status !== "approved") {
          throw new InvalidPersonaStatusError("Can only delete users with 'approved' status")
        }

        t.delete(userRef)

        // Build document data for destroyedUsers entry
        const newDeletion = {
          countryCode: user.data()?.countryCode || "",
          burnedUidType: burnedUidType.toString(),
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
          const deletions = [...(destroyedUser.data()?.deletions || []), newDeletion]
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
          t.set(destroyedUserRef, updatedDocument)
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

    return res.status(200).send({status: "success"})
  },
})

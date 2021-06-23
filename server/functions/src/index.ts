import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import {ethers} from "ethers"
import {getDb, getUsers} from "./db"
import firestore = admin.firestore

admin.initializeApp()

// Make sure this is in sync with the frontend. This should have a none for added security, but it should be ok for now
const VERIFICATION_MESSAGE = "Sign in to Goldfinch"

const ALLOWED_ORIGINS = ["http://localhost:3000", "https://app.goldfinch.finance"]

const setCORSHeaders = (req: any, res: any) => {
  if (ALLOWED_ORIGINS.includes(req.headers.origin)) {
    res.set("Access-Control-Allow-Origin", req.headers.origin)
  }
}

const kycStatus = functions.https.onRequest(
  async (req, res): Promise<any> => {
    const address = req.query.address?.toString()
    const signature = req.query.signature?.toString()

    const response = {address: address, status: "unknown"}
    setCORSHeaders(req, res)

    if (!address || !signature) {
      return res.status(400).send({error: "Address or signature not provided"})
    }

    const verifiedAddress = ethers.utils.verifyMessage(VERIFICATION_MESSAGE, signature)

    console.log(`Received address: ${address}, Verified address: ${verifiedAddress}`)

    if (address.toLowerCase() !== verifiedAddress.toLowerCase()) {
      return res.status(403).send({error: "Invalid address or signature"})
    }

    const users = getUsers(admin.firestore())
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (user.exists) {
      response.status = user.data()?.status
    }
    return res.status(200).send(response)
  },
)

// Top level status transitions should be => pending -> approved | failed -> golisted
// Where:
//  pending: persona verification attempted. Could be in a lot of stages here, persona is the source of truth
//  approved: Approved on persona, but not yet golisted on chain
//  failed: Failed on persona
//  golisted: golisted on chain
const userStatusFromPersonaStatus = (currentStatus: string, personaStatus: string) => {
  // If we're past the persona approvals, then don't change the user status
  if (currentStatus === "approved" || currentStatus === "golisted") {
    return currentStatus
  }
  if (personaStatus === "completed" || personaStatus === "approved") {
    return "approved"
  }
  if (personaStatus === "failed" || personaStatus === "expired" || personaStatus === "declined") {
    return "failed"
  }
  return "pending"
}

const personaCallback = functions.https.onRequest(
  async (req, res): Promise<any> => {
    const eventPayload = req.body.data.attributes.payload.data

    const address = eventPayload.attributes.referenceId
    const db = getDb(admin.firestore())
    const userRef = getUsers(admin.firestore()).doc(`${address.toLowerCase()}`)

    try {
      await db.runTransaction(async (t: firestore.Transaction) => {
        const doc = await t.get(userRef)

        if (doc.exists) {
          const userData = doc.data()
          t.update(userRef, {
            status: userStatusFromPersonaStatus(userData?.status, eventPayload.attributes.status),
            persona: {
              id: eventPayload.id,
              status: eventPayload.attributes.status,
            },
            updatedAt: Date.now(),
          })
        } else {
          t.set(userRef, {
            address: address,
            persona: {
              id: eventPayload.id,
              status: eventPayload.attributes.status,
            },
            status: userStatusFromPersonaStatus("", eventPayload.attributes.status),
            updatedAt: Date.now(),
          })
        }
      })
    } catch (e) {
      console.error(e)
      return res.status(500).send({status: "error", message: e.message})
    }

    return res.status(200).send({status: "success"})
  },
)

export {kycStatus, personaCallback}

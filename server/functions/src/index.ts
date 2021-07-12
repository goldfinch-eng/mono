import * as crypto from "crypto"
import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import {ethers} from "ethers"
import {getDb, getUsers, getConfig} from "./db"
import firestore = admin.firestore

admin.initializeApp()

// Make sure this is in sync with the frontend. This should have a none for added security, but it should be ok for now
const VERIFICATION_MESSAGE = "Sign in to Goldfinch"

const setCORSHeaders = (req: any, res: any) => {
  const allowedOrigins = (getConfig(functions).kyc.allowed_origins || "").split(",")
  if (allowedOrigins.includes(req.headers.origin)) {
    res.set("Access-Control-Allow-Origin", req.headers.origin)
  }
}

const kycStatus = functions.https.onRequest(
  async (req, res): Promise<any> => {
    const address = req.query.address?.toString()
    const signature = req.query.signature?.toString()

    const response = {address: address, status: "unknown", countryCode: null}
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
      response.status = userStatusFromPersonaStatus(user.data()?.persona?.status)
      response.countryCode = user.data()?.countryCode
    }
    return res.status(200).send(response)
  },
)

// Top level status transitions should be => pending -> approved | failed -> golisted
// Where:
//  pending: persona verification attempted. Could be in a lot of stages here, persona is the source of truth
//  approved: Approved on persona, but not yet golisted on chain
//  failed: Failed on persona
const userStatusFromPersonaStatus = (personaStatus: string) => {
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

const verifyRequest = (req: functions.https.Request) => {
  const personaConfig = getConfig(functions).persona
  const webhookSecret = personaConfig?.secret
  const allowedIps = personaConfig["allowed_ips"]

  if (allowedIps && !allowedIps.split(",").includes(req.ip)) {
    console.error(`Disallowed ip ${req.ip}`)
    return false
  }

  if (!webhookSecret) {
    return true
  }

  // Ensure the request is really from persona by validating the signature.
  // See https://docs.withpersona.com/docs/webhooks#checking-signatures
  const sigParams: Record<string, string> = {}
  const signature = req.headers["persona-signature"] as string

  if (!signature) {
    return false
  }
  signature.split(",").forEach((pair: string) => {
    const [key, value] = pair.split("=")
    sigParams[key] = value
  })

  if (sigParams.t && sigParams.v1) {
    const hmac = crypto.createHmac("sha256", webhookSecret).update(`${sigParams.t}.${req.body}`).digest("hex")
    const isSignatureCorrect = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sigParams.v1))
    if (!isSignatureCorrect) {
      console.error(`Invalid signature. Expected: ${sigParams.v1}, actual: ${hmac}`)
    }
    return isSignatureCorrect
  } else {
    return false
  }
}

const getCountryCode = (eventPayload: Record<string, any>): string | null => {
  const account = eventPayload.included.find((i: any) => i.type === "account")
  const verification = eventPayload.included.find((i: any) => i.type === "verification/government-id")
  // If not countryCode is found, use an explicit null, firestore does not like "undefined"
  return account?.attributes?.countryCode || verification?.attributes?.countryCode || null
}

const personaCallback = functions.https.onRequest(
  async (req, res): Promise<any> => {
    if (!verifyRequest(req)) {
      return res.status(400).send({status: "error", message: "Request could not be verified"})
    }

    const eventPayload = req.body.data.attributes.payload.data

    const address = eventPayload.attributes.referenceId
    const countryCode = getCountryCode(req.body.data.attributes.payload)
    const db = getDb(admin.firestore())
    const userRef = getUsers(admin.firestore()).doc(`${address.toLowerCase()}`)

    try {
      await db.runTransaction(async (t: firestore.Transaction) => {
        const doc = await t.get(userRef)

        if (doc.exists) {
          // If the user was already approved, then ignore further updates
          if (doc.data()?.persona?.status === "approved") {
            return
          }

          t.update(userRef, {
            persona: {
              id: eventPayload.id,
              status: eventPayload.attributes.status,
            },
            countryCode: countryCode,
            updatedAt: Date.now(),
          })
        } else {
          t.set(userRef, {
            address: address,
            persona: {
              id: eventPayload.id,
              status: eventPayload.attributes.status,
            },
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

import * as Sentry from "@sentry/serverless"
import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import * as crypto from "crypto"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import {assertIsString} from "@goldfinch-eng/utils"
import {getConfig, getDb, getUsers} from "../db"
import {genRequestHandler} from "../helpers"
import firestore = admin.firestore
import {KycProvider} from "../types"

const verifyRequest = (req: Request) => {
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
  const sigParams: Record<string, string | undefined> = {}
  const signature = req.headers["persona-signature"] as string

  if (!signature) {
    return false
  }
  signature.split(",").forEach((pair: string) => {
    const [key, value] = pair.split("=")
    assertIsString(key)
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

const getCountryCode = (eventPayload: {
  included: [{type: string; attributes: {status: string; countryCode: string}}]
}): string | null => {
  const account = eventPayload.included.find((i) => i.type === "account")
  const verification = eventPayload.included.find(
    (i) => i.type === "verification/government-id" && i.attributes.status === "passed",
  )
  // If not countryCode is found, use an explicit null, firestore does not like "undefined"
  return account?.attributes?.countryCode || verification?.attributes?.countryCode || null
}

export const personaCallback = genRequestHandler({
  requireAuth: "none",
  cors: false,
  handler: async (req, res): Promise<Response> => {
    if (!verifyRequest(req)) {
      return res.status(400).send({status: "error", message: "Request could not be verified"})
    }

    const eventPayload = req.body.data.attributes.payload.data

    const {referenceId: address, status} = eventPayload.attributes

    // Having verified the request, we can set the Sentry user context accordingly.
    Sentry.setUser({id: address, address})

    const countryCode = getCountryCode(req.body.data.attributes.payload)
    const db = getDb(admin.firestore())
    const userRef = getUsers(admin.firestore()).doc(`${address.toLowerCase()}`)

    try {
      await db.runTransaction(async (t: firestore.Transaction) => {
        const doc = await t.get(userRef)

        if (doc.exists) {
          const existingData = doc.data()

          t.update(userRef, {
            persona: {
              id: eventPayload.id,
              status: existingData?.persona?.status === "approved" ? "approved" : status,
            },
            kycProvider: KycProvider.Persona.valueOf(),
            countryCode: countryCode || existingData?.countryCode || null,
            updatedAt: Date.now(),
          })
        } else {
          t.set(userRef, {
            address: address,
            persona: {
              id: eventPayload.id,
              status,
            },
            kycProvider: KycProvider.Persona.valueOf(),
            countryCode,
            updatedAt: Date.now(),
          })
        }
      })
    } catch (e) {
      console.error(e)
      return res.status(500).send({status: "error", message: (e as Error)?.message})
    }

    return res.status(200).send({status: "success"})
  },
})

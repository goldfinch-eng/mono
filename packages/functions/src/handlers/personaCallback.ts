import * as Sentry from "@sentry/serverless"
import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import * as crypto from "crypto"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import {assertIsString} from "@goldfinch-eng/utils"
import {getDb, getUsers} from "../db/db"
import {getConfig} from "../config"
import {genRequestHandler} from "../helpers"
import firestore = admin.firestore
import {KycProvider} from "../types"
import {AllEntities, GeneralPersonaEventRequest, isAccount, isInquiryEvent, isVerification} from "./persona/types"

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

const getCountryCode = (entities: AllEntities[]): string | undefined => {
  const account = entities.find(isAccount)
  const verification = entities
    .filter(isVerification("verification/government-id"))
    .find((i) => i.attributes.status === "passed")

  return account?.attributes?.countryCode || verification?.attributes?.countryCode
}

export const personaCallback = genRequestHandler({
  requireAuth: "none",
  cors: false,
  handler: async (req, res): Promise<Response> => {
    if (!verifyRequest(req)) {
      return res.status(400).send({status: "error", message: "Request could not be verified"})
    }

    const event = req.body as GeneralPersonaEventRequest

    if (isInquiryEvent(event)) {
      const {data: inquiry, included: relatedEntities} = event.data.attributes.payload

      const {referenceId: address, status} = inquiry.attributes

      if (!address) {
        console.error(`Inquiry ${inquiry.id} has no reference id`)
        return res.status(500).send({status: "error", message: `referenceId is null for ${inquiry.id}`})
      }

      // Having verified the request, we can set the Sentry user context accordingly.
      Sentry.setUser({id: address, address})

      const countryCode = getCountryCode(relatedEntities)
      const db = getDb()
      const userRef = getUsers().doc(`${address.toLowerCase()}`)

      try {
        await db.runTransaction(async (t: firestore.Transaction) => {
          const doc = await t.get(userRef)

          if (doc.exists) {
            const existingData = doc.data()

            if (!existingData || existingData.kycProvider === KycProvider.ParallelMarkets) {
              throw new Error(`User ${address} is not using Persona`)
            }

            t.set(
              userRef,
              {
                persona: {
                  id: inquiry.id,
                  status: existingData?.persona?.status === "approved" ? "approved" : status,
                },
                kycProvider: "persona",
                countryCode,
                updatedAt: Date.now(),
              },
              {merge: true},
            )
          } else {
            t.set(userRef, {
              address: address,
              persona: {
                id: inquiry.id,
                status,
              },
              kycProvider: "persona",
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
    } else {
      console.error(`Unhandled event received: ${event.data.attributes.name}`)
    }

    return res.status(200).send({status: "success"})
  },
})

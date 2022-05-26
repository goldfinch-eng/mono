import {CaptureConsole} from "@sentry/integrations"
import * as Sentry from "@sentry/serverless"
import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import * as crypto from "crypto"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import dotenv from "dotenv"
import {findEnvLocal, assertIsString} from "@goldfinch-eng/utils"
import {getAgreements, getConfig, getDb, getUsers} from "./db"
import {genRequestHandler} from "./helpers"
import {SignatureVerificationSuccessResult} from "./types"
import firestore = admin.firestore
import {circulatingSupply} from "./handlers/circulatingSupply"
dotenv.config({path: findEnvLocal()})

const _config = getConfig(functions)
Sentry.GCPFunction.init({
  dsn: _config.sentry.dsn,
  integrations: [
    new CaptureConsole({
      levels: ["log", "info", "warn", "error"],
    }),
  ],
  release: _config.sentry.release,
  environment: _config.sentry.environment,
  tracesSampleRate: _config.sentry.environment === "production" ? 0.25 : 1.0,
})

admin.initializeApp()

const kycStatus = genRequestHandler({
  requireAuth: true,
  cors: true,
  handler: async (
    req: Request,
    res: Response,
    verificationResult: SignatureVerificationSuccessResult,
  ): Promise<Response> => {
    const address = verificationResult.address
    const payload = {address: address, status: "unknown", countryCode: null}

    const users = getUsers(admin.firestore())
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (user.exists) {
      payload.status = userStatusFromPersonaStatus(user.data()?.persona?.status)
      payload.countryCode = user.data()?.countryCode
    }
    return res.status(200).send(payload)
  },
})

// Top level status transitions should be => pending -> approved | failed -> golisted
// Where:
//  pending: persona verification attempted. Could be in a lot of stages here, persona is the source of truth
//  approved: Approved on persona, but not yet golisted on chain
//  failed: Failed on persona
const userStatusFromPersonaStatus = (personaStatus: string): "unknown" | "approved" | "failed" => {
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

const getCountryCode = (eventPayload: Record<string, any>): string | null => {
  const account = eventPayload.included.find((i: any) => i.type === "account")
  const verification = eventPayload.included.find(
    (i: any) => i.type === "verification/government-id" && i.attributes.status === "passed",
  )
  // If not countryCode is found, use an explicit null, firestore does not like "undefined"
  return account?.attributes?.countryCode || verification?.attributes?.countryCode || null
}

// signAgreement is used to be shared with the borrowers
const signAgreement = genRequestHandler({
  requireAuth: false,
  cors: true,
  handler: async (req: Request, res: Response): Promise<Response> => {
    const addressHeader = req.headers["x-goldfinch-address"]
    const address = Array.isArray(addressHeader) ? addressHeader.join("") : addressHeader
    const pool = (req.body.pool || "").trim()

    if (!address) {
      return res.status(403).send({error: "Invalid address"})
    }
    const fullName = (req.body.fullName || "").trim()

    if (pool === "" || fullName === "") {
      return res.status(403).send({error: "Invalid name or pool"})
    }

    const agreements = getAgreements(admin.firestore())
    const key = `${pool.toLowerCase()}-${address.toLowerCase()}`
    const agreement = await agreements.doc(key)
    await agreement.set({
      address: address,
      pool: pool,
      fullName: fullName,
      signedAt: Date.now(),
    })
    return res.status(200).send({status: "success"})
  },
})

const personaCallback = genRequestHandler({
  requireAuth: false,
  cors: false,
  handler: async (req, res): Promise<Response> => {
    if (!verifyRequest(req)) {
      return res.status(400).send({status: "error", message: "Request could not be verified"})
    }

    const eventPayload = req.body.data.attributes.payload.data

    const address = eventPayload.attributes.referenceId

    // Having verified the request, we can set the Sentry user context accordingly.
    Sentry.setUser({id: address, address})

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
      return res.status(500).send({status: "error", message: (e as Error)?.message})
    }

    return res.status(200).send({status: "success"})
  },
})

export {kycStatus, personaCallback, signAgreement, circulatingSupply}

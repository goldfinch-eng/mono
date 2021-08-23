import * as crypto from "crypto"
import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import {ethers} from "ethers"
import {getDb, getUsers, getConfig} from "./db"
import firestore = admin.firestore
import {assertIsString} from "../../../utils/type"
import * as Sentry from "@sentry/serverless"
import {CaptureConsole} from "@sentry/integrations"
import {HttpFunction, Request} from "@sentry/serverless/dist/gcpfunction/general"
import {HttpFunctionWrapperOptions} from "@sentry/serverless/dist/gcpfunction"

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

// Make sure to keep the structure of this message in sync with the frontend.
const genVerificationMessage = (timestamp: string) => `Sign in to Goldfinch: ${timestamp}`

// Cf. https://stackoverflow.com/a/12372720
const isValidDate = (date: Date): boolean => !isNaN(date.getTime())

const ONE_MINUTE_MILLIS = 1000 * 60
const ONE_HOUR_MILLIS = 1000 * 60 * 60

const setCORSHeaders = (req: any, res: any) => {
  const allowedOrigins = (getConfig(functions).kyc.allowed_origins || "").split(",")
  if (allowedOrigins.includes(req.headers.origin)) {
    res.set("Access-Control-Allow-Origin", req.headers.origin)
    res.set("Access-Control-Allow-Headers", "x-goldfinch-signature, x-goldfinch-signature-timestamp")
  }
}

/**
 * Helper for augmenting Sentry's default behavior for route handlers.
 * @param {HttpFunction} fn The route handler we want to wrap.
 * @param {Partial<HttpFunctionWrapperOptions>} wrapOptions Options to pass to Sentry's wrap function.
 * @return {HttpFunction} The wrapped handler suitable for passing to `functions.https.onRequest()`.
 */
const wrapWithSentry = (fn: HttpFunction, wrapOptions?: Partial<HttpFunctionWrapperOptions>): HttpFunction => {
  return Sentry.GCPFunction.wrapHttpFunction(async (req, res): Promise<void> => {
    // Sentry does not fully do its job as you'd expect; currently it is not instrumented for
    // unhandled promise rejections! So to capture such events in Sentry, we must catch and
    // send them manually. Cf. https://github.com/getsentry/sentry-javascript/issues/3695#issuecomment-872350258,
    // https://github.com/getsentry/sentry-javascript/issues/3096#issuecomment-775582236.
    try {
      await fn(req, res)
    } catch (err: unknown) {
      Sentry.captureException(err)
      res.status(500).send("Internal error.")
    }
  }, wrapOptions)
}

const kycStatus = functions.https.onRequest(
  wrapWithSentry(async (req, res): Promise<void> => {
    setCORSHeaders(req, res)

    // For a CORS preflight request, we're done.
    if (req.method === "OPTIONS") {
      res.status(200).send()
      return
    }

    const address = req.query.address?.toString()
    const signatureHeader = req.headers["x-goldfinch-signature"]
    const signature = Array.isArray(signatureHeader) ? signatureHeader.join("") : signatureHeader
    const signatureTimestampHeader = req.headers["x-goldfinch-signature-timestamp"]
    const signatureTimestamp = Array.isArray(signatureTimestampHeader)
      ? signatureTimestampHeader.join("")
      : signatureTimestampHeader

    if (!address) {
      res.status(400).send({error: "Address not provided."})
      return
    }
    if (!signature) {
      res.status(400).send({error: "Signature not provided."})
      return
    }
    if (!signatureTimestamp) {
      res.status(400).send({error: "Signature timestamp not provided."})
      return
    }

    const verifiedAddress = ethers.utils.verifyMessage(genVerificationMessage(signatureTimestamp), signature)

    console.log(`Received address: ${address}, Verified address: ${verifiedAddress}`)

    if (address.toLowerCase() !== verifiedAddress.toLowerCase()) {
      res.status(403).send({error: "Invalid address or signature"})
      return
    }

    const signatureDate: Date = new Date(signatureTimestamp)
    if (!isValidDate(signatureDate)) {
      res.status(400).send({error: "Invalid signature timestamp."})
      return
    }
    const signatureTime = signatureDate.getTime()
    const now = Date.now()
    // Don't allow signatures signed for the future. (We allow a one-minute margin-of-error
    // to accommodate differences between the client's clock that generated the timestamp
    // and the server's clock that is verifying it.)
    if (signatureTime > now + ONE_MINUTE_MILLIS) {
      res.status(401).send({error: "Unexpected signature timestamp."})
      return
    }
    // Don't allow signatures more than an hour old.
    if (signatureTime + ONE_HOUR_MILLIS < now) {
      res.status(401).send({error: "Signature expired."})
      return
    }

    // Having verified the address, we can set the Sentry user context accordingly.
    Sentry.setUser({id: address.toLowerCase(), address: address.toLowerCase()})

    const response = {address: address, status: "unknown", countryCode: null}

    const users = getUsers(admin.firestore())
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (user.exists) {
      response.status = userStatusFromPersonaStatus(user.data()?.persona?.status)
      response.countryCode = user.data()?.countryCode
    }
    res.status(200).send(response)
  }),
)

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
  const verification = eventPayload.included.find((i: any) => i.type === "verification/government-id")
  // If not countryCode is found, use an explicit null, firestore does not like "undefined"
  return account?.attributes?.countryCode || verification?.attributes?.countryCode || null
}

const personaCallback = functions.https.onRequest(
  wrapWithSentry(async (req, res): Promise<void> => {
    if (!verifyRequest(req)) {
      res.status(400).send({status: "error", message: "Request could not be verified"})
      return
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
      res.status(500).send({status: "error", message: e.message})
      return
    }

    res.status(200).send({status: "success"})
  }),
)

export {kycStatus, personaCallback}

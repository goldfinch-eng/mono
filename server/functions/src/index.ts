import * as crypto from "crypto"
import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import {ethers} from "ethers"
import {getNetwork} from "@ethersproject/networks"
import {getDb, getUsers, getConfig} from "./db"
import firestore = admin.firestore
import {assertIsString} from "../../../utils/type"
import * as Sentry from "@sentry/serverless"
import {CaptureConsole} from "@sentry/integrations"
import {HttpFunction, Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {HttpFunctionWrapperOptions} from "@sentry/serverless/dist/gcpfunction"
import {BaseProvider} from "@ethersproject/providers"

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
const genVerificationMessage = (blockNum: number) => `Sign in to Goldfinch: ${blockNum}`

const ONE_DAY_SECONDS = 60 * 60 * 24

const setCORSHeaders = (req: any, res: any) => {
  const allowedOrigins = (getConfig(functions).kyc.allowed_origins || "").split(",")
  if (allowedOrigins.includes(req.headers.origin)) {
    res.set("Access-Control-Allow-Origin", req.headers.origin)
    res.set("Access-Control-Allow-Headers", "x-goldfinch-signature, x-goldfinch-signature-block-num")
  }
}

/**
 * Maps a request origin to the url or chain id of the blockchain that is appropriate to use in
 * servicing the request.
 */
const blockchainIdentifierByOrigin: {[origin: string]: string | number} = {
  "http://localhost:3000": "http://localhost:8545",
  "https://murmuration.goldfinch.finance": "https://murmuration.goldfinch.finance/_chain",
  "https://app.goldfinch.finance": 1,
}

/**
 * Implements default `getBlockchain()` behavior: uses request origin to identify the
 * appropriate blockchain, defaulting to mainnet if one could not be identified.
 */
const _defaultGetBlockchain = (origin: string): BaseProvider => {
  let blockchain = blockchainIdentifierByOrigin[origin]
  if (!blockchain) {
    console.warn(`Failed to identify appropriate blockchain for request origin: ${origin}. Defaulting to mainnet.`)
    blockchain = 1
  }
  const network = typeof blockchain === "number" ? getNetwork(blockchain) : blockchain
  return ethers.getDefaultProvider(network)
}

/**
 * This function is the API that our server functions should use if they need to get blockchain data.
 */
let getBlockchain: (origin: string) => BaseProvider = _defaultGetBlockchain

/**
 * Helper that uses the dependency-injection pattern to enable mocking the blockchain provider.
 * Useful for testing purposes.
 */
const mockGetBlockchain = (mock: ((origin: string) => BaseProvider) | undefined): void => {
  getBlockchain = mock || _defaultGetBlockchain
}

/**
 * Helper for augmenting Sentry's default behavior for route handlers.
 * @param {HttpFunction} fn The route handler we want to wrap.
 * @param {Partial<HttpFunctionWrapperOptions>} wrapOptions Options to pass to Sentry's wrap function.
 * @return {HttpFunction} The wrapped handler suitable for passing to `functions.https.onRequest()`.
 */
const wrapWithSentry = (fn: HttpFunction, wrapOptions?: Partial<HttpFunctionWrapperOptions>): HttpFunction => {
  if (process.env.NODE_ENV === "test") {
    // If we're in a testing environment, Sentry's wrapper just gets in the way of intelligible test
    // errors. So we won't use it.
    return fn
  }

  return Sentry.GCPFunction.wrapHttpFunction(async (req, res): Promise<Response> => {
    // Sentry does not fully do its job as you'd expect; currently it is not instrumented for
    // unhandled promise rejections! So to capture such events in Sentry, we must catch and
    // send them manually. Cf. https://github.com/getsentry/sentry-javascript/issues/3695#issuecomment-872350258,
    // https://github.com/getsentry/sentry-javascript/issues/3096#issuecomment-775582236.
    try {
      return await fn(req, res)
    } catch (err: unknown) {
      Sentry.captureException(err)
      return res.status(500).send("Internal error.")
    }
  }, wrapOptions)
}

const kycStatus = functions.https.onRequest(
  wrapWithSentry(async (req, res): Promise<Response> => {
    setCORSHeaders(req, res)

    // For a CORS preflight request, we're done.
    if (req.method === "OPTIONS") {
      return res.status(200).send()
    }

    const address = req.query.address?.toString()
    const signatureHeader = req.headers["x-goldfinch-signature"]
    const signature = Array.isArray(signatureHeader) ? signatureHeader.join("") : signatureHeader
    const signatureBlockNumHeader = req.headers["x-goldfinch-signature-block-num"]
    const signatureBlockNumStr = Array.isArray(signatureBlockNumHeader)
      ? signatureBlockNumHeader.join("")
      : signatureBlockNumHeader

    if (!address) {
      return res.status(400).send({error: "Address not provided."})
    }
    if (!signature) {
      return res.status(400).send({error: "Signature not provided."})
    }
    if (!signatureBlockNumStr) {
      return res.status(400).send({error: "Signature block number not provided."})
    }

    const signatureBlockNum = parseInt(signatureBlockNumStr, 10)
    if (!Number.isInteger(signatureBlockNum)) {
      return res.status(400).send({error: "Invalid signature block number."})
    }

    const verifiedAddress = ethers.utils.verifyMessage(genVerificationMessage(signatureBlockNum), signature)

    console.log(`Received address: ${address}, Verified address: ${verifiedAddress}`)

    if (address.toLowerCase() !== verifiedAddress.toLowerCase()) {
      return res.status(401).send({error: "Invalid address or signature."})
    }

    const origin = req.headers.origin || ""
    const blockchain = getBlockchain(origin)
    const currentBlock = await blockchain.getBlock("latest")

    // Don't allow signatures signed for the future.
    if (currentBlock.number < signatureBlockNum) {
      return res.status(401).send({error: "Unexpected signature block number."})
    }

    const signatureBlock = await blockchain.getBlock(signatureBlockNum)
    const signatureTime = signatureBlock.timestamp
    const now = currentBlock.timestamp

    // Don't allow signatures more than a day old.
    if (signatureTime + ONE_DAY_SECONDS < now) {
      return res.status(401).send({error: "Signature expired."})
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
    return res.status(200).send(response)
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
  wrapWithSentry(async (req, res): Promise<Response> => {
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
      return res.status(500).send({status: "error", message: e.message})
    }

    return res.status(200).send({status: "success"})
  }),
)

export {kycStatus, personaCallback, mockGetBlockchain}

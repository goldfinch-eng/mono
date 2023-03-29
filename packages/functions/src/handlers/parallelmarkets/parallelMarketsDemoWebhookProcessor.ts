import * as crypto from "crypto"
import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {genRequestHandler} from "../../helpers"
import {assertIsString} from "@goldfinch-eng/utils"

// URL
// https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/parallelMarketsDemoWebhookProcessor

const PARALLEL_TIMESTAMP_HEADER = "Parallel-Timestamp"
const PARALLEL_SIGNATURE_HEADER = "Parallel-Signature"

const isValidPMRequest = async (
  unixTimestamp: string,
  signature: string,
  webhookKey: string,
  rawRequestBody: string,
) => {
  // Log everything so we can debug
  console.log("timestamp")
  console.log(unixTimestamp)

  console.log("signature")
  console.log(signature)

  console.log("webhookKey")
  console.log(webhookKey)

  console.log("rawRequestBody")
  console.log(rawRequestBody)

  const decodedWebhookKey = Buffer.from(webhookKey, "base64")
  const hmac = crypto.createHmac("sha256", decodedWebhookKey)
  const sig = hmac.update(unixTimestamp + rawRequestBody).digest("base64")
  return Buffer.from(signature).equals(Buffer.from(sig))
}

export const parallelMarketsDemoWebhookProcessor = genRequestHandler({
  requireAuth: "none",
  cors: true,
  handler: async (request: Request, response: Response): Promise<Response> => {
    console.log("Received request with body")
    console.log(request.body)

    // Validate the request came from parallel markets
    const unixTimestamp = request.headers[PARALLEL_TIMESTAMP_HEADER]
    const signature = request.headers[PARALLEL_SIGNATURE_HEADER]
    const webhookKey = process.env.PARALLEL_WEBHOOK_KEY
    assertIsString(unixTimestamp)
    assertIsString(signature)
    assertIsString(webhookKey)
    const isValidRequest = isValidPMRequest(unixTimestamp, signature, webhookKey, JSON.stringify(request.body))
    if (!isValidRequest) {
      return response.status(403).send({msg: "invalid signature"})
    }

    return response.status(200).send({status: "valid signature"})
  },
})

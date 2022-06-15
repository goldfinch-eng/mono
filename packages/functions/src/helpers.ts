import {getNetwork} from "@ethersproject/networks"
import {BaseProvider} from "@ethersproject/providers"
import * as Sentry from "@sentry/serverless"
import {HttpFunctionWrapperOptions} from "@sentry/serverless/dist/gcpfunction"
import {HttpFunction, Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {ethers} from "ethers"
import * as functions from "firebase-functions"
import {getConfig} from "./db"
import {RequestHandlerConfig, SignatureVerificationResult} from "./types"
import _ from "lodash"
import {assertUnreachable} from "@goldfinch-eng/utils"

// Make sure to keep the structure of this message in sync with the frontend.
const genVerificationMessage = (blockNum: number) => `Sign in to Goldfinch: ${blockNum}`

const ONE_DAY_SECONDS = 60 * 60 * 24

// This is not a secret, so it's ok to hardcode this
const INFURA_PROJECT_ID = "d8e13fc4893e4be5aae875d94fee67b7"

const setCORSHeaders = (req: Request, res: Response) => {
  const allowedOrigins = (getConfig(functions).kyc.allowed_origins || "").split(",")
  const origin = req.headers.origin || ""
  if (originAllowed(allowedOrigins, origin)) {
    res.set("Access-Control-Allow-Origin", req.headers.origin)
    res.set("Access-Control-Allow-Headers", "*")
  }
}

export const originAllowed = (allowedOrigins: string[], origin: string): boolean => {
  return _.some(allowedOrigins, (allowed) => {
    // Respect the wildcard operator
    const wildcard = "*"
    if (allowed.includes(wildcard)) {
      const allowedSplit = allowed.split(wildcard)
      return _.every(allowedSplit, (allowedPiece) => {
        return origin.includes(allowedPiece.trim())
      })
    } else {
      return origin.includes(allowed)
    }
  })
}

/**
 * Maps a request origin to the url or chain id of the blockchain that we consider the appropriate
 * one to use by default in servicing the request.
 */
const defaultBlockchainIdentifierByOrigin: {[origin: string]: string | number} = {
  "http://localhost:3000": "http://localhost:8545",
  "https://murmuration.goldfinch.finance": "https://murmuration.goldfinch.finance/_chain",
  "https://beta.app.goldfinch.finance": "https://murmuration.goldfinch.finance/_chain",
  "https://app.goldfinch.finance": 1,
}
const overrideBlockchainIdentifier = (): string | number | undefined => {
  const override = process.env.CHAIN_IDENTIFIER
  const overrideNumber = override ? parseInt(override, 10) : undefined
  return overrideNumber && !isNaN(overrideNumber) ? overrideNumber : override
}

/**
 * Provides the blockchain we want to use in servicing a request. In descending priority, this is:
 * the chain specified by the CHAIN_IDENTIFIER env variable (this supports e.g. a client running on
 * localhost using mainnet, rinkeby, etc.); the chain we consider the default appropriate one given the
 * request origin; mainnet, if the chain was not otherwise identified.
 * @param {string} origin The request origin.
 * @return {BaseProvider} The blockchain provider.
 */
const _getBlockchain = (origin: string): BaseProvider => {
  let blockchain = overrideBlockchainIdentifier() || defaultBlockchainIdentifierByOrigin[origin]
  if (!blockchain) {
    console.warn(`Failed to identify appropriate blockchain for request origin: ${origin}. Defaulting to mainnet.`)
    blockchain = 1
  }
  const network = typeof blockchain === "number" ? getNetwork(blockchain) : blockchain
  // If we're using urls for the network (hardhat or murmuration) use the default provider
  if (typeof network === "string" && network.match(/^(ws|http)s?:/i)) {
    return ethers.getDefaultProvider(network)
  } else {
    return new ethers.providers.InfuraProvider(network, INFURA_PROJECT_ID)
  }
}

/**
 * This function is the API that our server functions should use if they need to get blockchain data.
 */
export let getBlockchain: (origin: string) => BaseProvider = _getBlockchain

/**
 * Helper that uses the dependency-injection pattern to enable mocking the blockchain provider.
 * Useful for testing purposes.
 * @callback mocked
 * @param {mocked|undefined} mock The getter to use to mock `getBlockchain()` behavior.
 */
export const mockGetBlockchain = (mock: ((origin: string) => BaseProvider) | undefined): void => {
  getBlockchain = mock || _getBlockchain
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
      // Sentry captures these error logs automatically. This also provides a fallback (google cloud logs) in
      // case sentry fails to capture the error (see above comment about unhandled promise rejections)
      console.error(err)
      return res.status(500).send("Internal error.")
    }
  }, wrapOptions)
}

/**
 * Verifies that the signature provided in the `x-goldfinch-signature` header is a valid message
 * signed by the address provided in the `x-goldfinch-address` header. Also verifies that this
 * signature has not expired, per the provided `x-goldfinch-signature-block-num` header -- which is
 * critical so that signatures can't confer privileges forever.
 *
 * This form of authentication is meant to support requests that we want only the end user, who
 * controls the private key behind the address, to be able to perform.
 *
 * If verification fails then the `res` property of the response object provides the status and reason
 * for the failure. If verification succeeds then the `res` property of the response object will be
 * undefined and the `address` property of the response object will be the address for which the
 * the verification succeeded.
 *
 * @param {Request} req The request being handled.
 * @param {Response} res The response to the request.
 * @return {Promise<SignatureVerificationResult>}
 */
const verifySignature = async (req: Request, res: Response): Promise<SignatureVerificationResult> => {
  const addressHeader = req.headers["x-goldfinch-address"]
  const address = Array.isArray(addressHeader) ? addressHeader.join("") : addressHeader
  const signatureHeader = req.headers["x-goldfinch-signature"]
  const signature = Array.isArray(signatureHeader) ? signatureHeader.join("") : signatureHeader
  const signatureBlockNumHeader = req.headers["x-goldfinch-signature-block-num"]
  const signatureBlockNumStr = Array.isArray(signatureBlockNumHeader)
    ? signatureBlockNumHeader.join("")
    : signatureBlockNumHeader

  if (!address) {
    return {res: res.status(400).send({error: "Address not provided."}), address: undefined}
  }
  if (!signature) {
    return {res: res.status(400).send({error: "Signature not provided."}), address: undefined}
  }
  if (!signatureBlockNumStr) {
    return {res: res.status(400).send({error: "Signature block number not provided."}), address: undefined}
  }

  Sentry.setUser({id: address, address})

  const signatureBlockNum = parseInt(signatureBlockNumStr, 10)
  if (!Number.isInteger(signatureBlockNum)) {
    return {res: res.status(400).send({error: "Invalid signature block number."}), address: undefined}
  }

  const verifiedAddress = ethers.utils.verifyMessage(genVerificationMessage(signatureBlockNum), signature)

  console.debug(`Received address: ${address}, Verified address: ${verifiedAddress}`)

  if (address.toLowerCase() !== verifiedAddress.toLowerCase()) {
    return {res: res.status(401).send({error: "Invalid address or signature."}), address: undefined}
  }

  const origin = req.headers.origin || ""
  const blockchain = getBlockchain(origin)
  const currentBlock = await blockchain.getBlock("latest")

  // Don't allow signatures signed for the future.
  if (currentBlock.number < signatureBlockNum) {
    return {
      res: res
        .status(401)
        .send({error: `Unexpected signature block number: ${currentBlock.number} < ${signatureBlockNum}`}),
      address: undefined,
    }
  }

  const signatureBlock = await blockchain.getBlock(signatureBlockNum)
  const signatureTime = signatureBlock.timestamp
  const now = currentBlock.timestamp

  // Don't allow signatures more than a day old.
  if (signatureTime + ONE_DAY_SECONDS < now) {
    console.error(`Signature expired: ${signatureTime} + ${ONE_DAY_SECONDS} < ${now}`)
    return {res: res.status(401).send({error: "Signature expired."}), address: undefined}
  }

  return {res: undefined, address}
}

/**
 * Verifies a signature in the same manner as `verifySignature` with the additional
 * constraint that the signer must be present in the `allowedSigners` list
 *
 * @param {Request} req The request being handled.
 * @param {Response} res The response to the request.
 * @param {Array<string>} allowedSigners the list of allowed signers
 * @return {Promise<VerificationResult>}
 */
const verifySignatureAndAllowList = async (
  req: Request,
  res: Response,
  allowedSigners: Array<string>,
): Promise<SignatureVerificationResult> => {
  if (allowedSigners.length === 0) {
    return {res: res.status(500).send({error: "Allow list should not be empty"}), address: undefined}
  }

  const signatureVerification = await verifySignature(req, res)

  if (signatureVerification.res) {
    return signatureVerification
  }

  // Checksum all the addresses to disambiguate
  const signerAddress = ethers.utils.getAddress(signatureVerification.address)
  allowedSigners = allowedSigners.map(ethers.utils.getAddress)

  const signerProhibited = allowedSigners.indexOf(signerAddress) === -1
  if (signerProhibited) {
    return {
      res: res.status(403).send({error: `Signer ${signerAddress} not allowed to call this function`}),
      address: undefined,
    }
  }

  return {res: undefined, address: signerAddress}
}

export const genRequestHandler = (config: RequestHandlerConfig): functions.HttpsFunction => {
  return functions.https.onRequest(
    wrapWithSentry(async (req, res): Promise<Response> => {
      if (config.cors) {
        setCORSHeaders(req, res)

        // For a CORS preflight request, we're done.
        if (req.method === "OPTIONS") {
          return res.status(200).send()
        }
      }

      const authType = config.requireAuth
      if (authType === "signature") {
        const verificationResult = await verifySignature(req, res)
        return verificationResult.res ? verificationResult.res : config.handler(req, res, verificationResult)
      } else if (authType === "signatureWithAllowList") {
        const verificationResult = await verifySignatureAndAllowList(req, res, config.signerAllowList)
        return verificationResult.res ? verificationResult.res : config.handler(req, res, verificationResult)
      } else if (authType === "none") {
        return config.handler(req, res)
      } else {
        assertUnreachable(authType)
      }
    }),
  )
}

import _ from "lodash"
import {ethers, Signer} from "ethers"
import * as Sentry from "@sentry/node"
import axios from "axios"
import {DefenderRelayProvider, DefenderRelaySigner} from "defender-relay-client/lib/ethers"
import {HandlerParams} from "../types"
import {
  assertNonNullable,
  getIDType as defaultGetIDType,
  Auth,
  presignedMintMessage,
  presignedMintToMessage,
  verifySignature,
  UNIQUE_IDENTITY_SIGNATURE_EXPIRY_TIME,
  KycStatusResponse,
} from "@goldfinch-eng/utils"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import UniqueIdentityDeployment from "@goldfinch-eng/protocol/deployments/mainnet/UniqueIdentity.json"
export const UNIQUE_IDENTITY_ABI = UniqueIdentityDeployment.abi
export const UNIQUE_IDENTITY_MAINNET_ADDRESS = "0xba0439088dc1e75F58e0A7C107627942C15cbb41"
import baseHandler from "../core/handler"

export const UniqueIdentityAbi = UniqueIdentityDeployment.abi

export type FetchKYCFunction = ({auth, chainId}: {auth: Auth; chainId: number}) => Promise<KycStatusResponse>

const API_URLS: {[key: number]: string} = {
  1: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  31337: "http://localhost:5001/goldfinch-frontends-dev/us-central1",
}

const defaultFetchKYCStatus: FetchKYCFunction = async ({auth, chainId}) => {
  const baseUrl = API_URLS[chainId]

  assertNonNullable(baseUrl, `No baseUrl function URL defined for chain ${chainId}`)
  const {data} = await axios.get(`${baseUrl}/kycStatus`, {headers: auth})
  return data as KycStatusResponse
}

const linkUserToUidStatus = async ({
  signerAddress,
  signature,
  presignedMessage,
  signatureBlockNum,
  chainId,
  expiresAt,
  nonce,
  uidType,
  msgSender,
  mintToAddress,
}) => {
  const baseUrl = API_URLS[chainId]
  assertNonNullable(baseUrl, `No baseUrl function URL defined for chain ${chainId}`)
  try {
    await axios.post(
      `${baseUrl}/linkUserToUid`,
      {
        expiresAt,
        nonce,
        uidType,
        msgSender,
        mintToAddress,
      },
      {
        headers: {
          "content-type": "application/json",
          "x-goldfinch-address": signerAddress,
          "x-goldfinch-signature": signature,
          "x-goldfinch-signature-plaintext": presignedMessage,
          "x-goldfinch-signature-block-num": signatureBlockNum,
        },
      }
    )
  } catch (error) {
    console.error(error)
    const errorResponse = (error as any)?.response
    throw new Error(
      "Error in request to /linkUserToUid.\n" +
        `status: ${JSON.stringify(errorResponse?.status)}\n` +
        `data: ${JSON.stringify(errorResponse?.data)}`
    )
  }
}

export function asAuth(obj: any): Auth {
  assertNonNullable(obj)

  if (typeof obj !== "object") {
    throw new Error("auth does not conform")
  }

  if (
    !(
      "x-goldfinch-address" in obj &&
      "x-goldfinch-signature" in obj &&
      "x-goldfinch-signature-block-num" in obj &&
      "x-goldfinch-signature-plaintext" in obj
    )
  ) {
    throw new Error("auth does not conform")
  }

  const auth = _.pick(obj, [
    "x-goldfinch-address",
    "x-goldfinch-signature",
    "x-goldfinch-signature-block-num",
    "x-goldfinch-signature-plaintext",
  ])

  return auth
}

// Entry point for OpenZeppelin Defender - presumes Mainnet
export const handler = baseHandler("unique-identity-signer", async (event: HandlerParams) => {
  if (!event.request || !event.request.body) throw new Error("Missing payload")

  const {auth, mintToAddress} = event.request.body

  const credentials = {...event}
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})

  const network = await signer.provider.getNetwork()
  const uniqueIdentity = new ethers.Contract(
    UNIQUE_IDENTITY_MAINNET_ADDRESS,
    UNIQUE_IDENTITY_ABI,
    signer
  ) as unknown as UniqueIdentity

  return await main({signer, auth, network, uniqueIdentity, mintToAddress})
})

// Main function
export async function main({
  auth,
  signer,
  network,
  uniqueIdentity,
  mintToAddress,
  fetchKYCStatus = defaultFetchKYCStatus,
  getIDType = defaultGetIDType,
}: {
  auth: any
  signer: Signer
  network: ethers.providers.Network
  uniqueIdentity: UniqueIdentity
  mintToAddress?: string
  fetchKYCStatus?: FetchKYCFunction
  getIDType?: typeof defaultGetIDType
}) {
  const userAddress = auth["x-goldfinch-address"]
  const signInSignature = auth["x-goldfinch-signature"]
  const signInSignatureBlockNum = auth["x-goldfinch-signature-block-num"]
  auth = asAuth(auth)

  assertNonNullable(signer.provider)
  if (!ethers.utils.isAddress(userAddress)) {
    throw new Error(`Invalid user address: ${userAddress}`)
  }
  if (mintToAddress && !ethers.utils.isAddress(mintToAddress)) {
    throw new Error(`Invalid address to mint to: ${mintToAddress}`)
  }

  await verifySignature(userAddress, signInSignature, signInSignatureBlockNum, signer.provider)
  Sentry.setUser({id: userAddress})

  // accredited individuals + entities do not go through persona
  let kycItem: KycStatusResponse | undefined = undefined

  try {
    kycItem = await fetchKYCStatus({auth, chainId: network.chainId})
  } catch (e) {
    console.error("fetchKYCStatus failed", e)
    throw e
  }

  if (!kycItem) {
    throw new Error("Unexpected undefined result from fetchKYCStatus")
  }

  const {status, countryCode} = kycItem

  if (status !== "approved") {
    throw new Error(`Does not meet mint requirements: status is ${kycItem.status}`)
  }

  if (!countryCode) {
    throw new Error(`Does not meet mint requirements: missing countryCode`)
  }

  const currentBlock = await signer.provider.getBlock("latest")
  const expiresAt = currentBlock.timestamp + UNIQUE_IDENTITY_SIGNATURE_EXPIRY_TIME
  const nonce = await uniqueIdentity.nonces(userAddress)
  const uidType = getIDType(kycItem)

  console.log(`Generating sig for UID type: ${uidType}`)

  let presignedMessage
  if (mintToAddress) {
    presignedMessage = presignedMintToMessage(
      userAddress,
      mintToAddress,
      uidType,
      expiresAt,
      uniqueIdentity.address,
      nonce,
      network.chainId
    )
  } else {
    presignedMessage = presignedMintMessage(
      userAddress,
      uidType,
      expiresAt,
      uniqueIdentity.address,
      nonce,
      network.chainId
    )
  }

  const signature = await signer.signMessage(presignedMessage)
  await linkUserToUidStatus({
    signerAddress: await signer.getAddress(),
    signature,
    presignedMessage,
    signatureBlockNum: currentBlock.number,
    chainId: network.chainId,
    expiresAt,
    nonce: nonce.toNumber(),
    uidType: uidType,
    msgSender: userAddress,
    mintToAddress,
  })

  return {signature, expiresAt, uidType}
}

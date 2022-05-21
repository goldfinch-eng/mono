import _ from "lodash"
import {ethers, Signer} from "ethers"
import axios from "axios"
import {DefenderRelayProvider, DefenderRelaySigner} from "defender-relay-client/lib/ethers"
import {HandlerParams} from "../types"
import {assertNonNullable, isPlainObject, isString} from "@goldfinch-eng/utils"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import UniqueIdentityDeployment from "@goldfinch-eng/protocol/deployments/mainnet/UniqueIdentity.json"
import {getIDType, isNonUSEntity, isUSAccreditedEntity, isUSAccreditedIndividual} from "./utils"
export const UniqueIdentityAbi = UniqueIdentityDeployment.abi

const SIGNATURE_EXPIRY_IN_SECONDS = 3600 // 1 hour

export interface KYC {
  status: "unknown" | "approved" | "failed"
  countryCode: string
}
const isStatus = (obj: unknown): obj is KYC["status"] => obj === "unknown" || obj === "approved" || obj === "failed"
const isKYC = (obj: unknown): obj is KYC => isPlainObject(obj) && isStatus(obj.status) && isString(obj.countryCode)

const API_URLS = {
  1: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  31337: "http://localhost:5001/goldfinch-frontends-dev/us-central1",
}

/**
 * Mapping of chain-id -> deployed address
 */
const UNIQUE_IDENTITY_ADDRESS = {
  1: "0xba0439088dc1e75F58e0A7C107627942C15cbb41",
}

export type FetchKYCFunction = ({auth: Auth, chainId: number}) => Promise<KYC>
const defaultFetchKYCStatus: FetchKYCFunction = async ({auth, chainId}) => {
  const baseUrl = API_URLS[chainId]
  assertNonNullable(baseUrl, `No function URL defined for chain ${chainId}`)
  const response = await axios.get(`${baseUrl}/kycStatus`, {headers: auth})
  if (isKYC(response.data)) {
    return response.data
  } else {
    throw new Error("malformed KYC response")
  }
}

type Auth = {
  "x-goldfinch-address": any
  "x-goldfinch-signature": any
  "x-goldfinch-signature-block-num": any
}

export function asAuth(obj: any): Auth {
  assertNonNullable(obj)

  if (typeof obj !== "object") {
    throw new Error("auth does not conform")
  }

  if (!("x-goldfinch-address" in obj && "x-goldfinch-signature" in obj && "x-goldfinch-signature-block-num" in obj)) {
    throw new Error("auth does not conform")
  }

  const auth = _.pick(obj, ["x-goldfinch-address", "x-goldfinch-signature", "x-goldfinch-signature-block-num"])

  return auth
}

export async function handler(event: HandlerParams) {
  if (!event.request || !event.request.body) throw new Error("Missing payload")

  const auth = event.request.body.auth

  const credentials = {...event}
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})

  const network = await signer.provider.getNetwork()
  const uniqueIdentityAddress = UNIQUE_IDENTITY_ADDRESS[network.chainId]
  assertNonNullable(uniqueIdentityAddress, "UniqueIdentity address is not defined for this network")
  const uniqueIdentity = new ethers.Contract(uniqueIdentityAddress, UniqueIdentityAbi, signer) as UniqueIdentity

  return await main({signer, auth: auth, network, uniqueIdentity})
}

// Main function
export async function main({
  auth,
  signer,
  network,
  uniqueIdentity,
  fetchKYCStatus = defaultFetchKYCStatus,
}: {
  auth: any
  signer: Signer
  network: ethers.providers.Network
  uniqueIdentity: UniqueIdentity
  fetchKYCStatus?: FetchKYCFunction
}) {
  assertNonNullable(signer.provider)
  auth = asAuth(auth)
  const userAddress = auth["x-goldfinch-address"]

  // accredited individuals + entities do not go through persona
  let kycStatus: KYC | undefined = undefined

  if (!isUSAccreditedEntity(userAddress) && !isUSAccreditedIndividual(userAddress) && !isNonUSEntity(userAddress)) {
    try {
      kycStatus = await fetchKYCStatus({auth, chainId: network.chainId})
    } catch (e) {
      console.error("fetchKYCStatus failed", e)
      throw new Error("fetchKYCStatus failed")
    }

    if (kycStatus.status !== "approved" || kycStatus.countryCode === "") {
      throw new Error("Does not meet mint requirements")
    }
  }

  const currentBlock = await signer.provider.getBlock("latest")
  const expiresAt = currentBlock.timestamp + SIGNATURE_EXPIRY_IN_SECONDS
  const nonce = await uniqueIdentity.nonces(userAddress)
  const idVersion = getIDType({
    address: userAddress,
    kycStatus,
  })

  const signTypes = ["address", "uint256", "uint256", "address", "uint256", "uint256"]
  const signParams = [userAddress, idVersion, expiresAt, uniqueIdentity.address, nonce, network.chainId]
  const encoded = pack(signTypes, signParams)
  const hashed = keccak256(encoded)
  const signature = await signer.signMessage(ethers.utils.arrayify(hashed))

  return {signature, expiresAt, idVersion}
}

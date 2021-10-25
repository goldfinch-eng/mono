import _ from "lodash"
import {Signer, ethers} from "ethers"
import axios from "axios"
import {DefenderRelaySigner, DefenderRelayProvider} from "defender-relay-client/lib/ethers"
import {HandlerParams, Request} from "../types"
import {assertNonNullable, isPlainObject, isString} from "@goldfinch-eng/utils"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import UniqueIdentityAbi from "./UniqueIdentity.json"

const SIGNATURE_EXPIRY_IN_SECONDS = 3600 // 1 hour

export interface KYC {
  status: "unknown" | "approved" | "failed"
  countryCode: string
}
const isStatus = (obj: unknown): obj is KYC["status"] => obj === "unknown" || obj === "approved" || obj === "failed"
const isKYC = (obj: unknown): obj is KYC => isPlainObject(obj) && isStatus(obj.status) && isString(obj.countryCode)

const API_URLS = {
  1: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  31337: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
}

const UNIQUE_IDENTITY_ADDRESS = {
  // TODO: Fill in when we deploy to mainnet
}

export type FetchKYCFunction = ({headers: any, chainId: number}) => Promise<KYC>
const defaultFetchKYCStatus: FetchKYCFunction = async ({headers, chainId}) => {
  const baseUrl = API_URLS[chainId]
  assertNonNullable(baseUrl, `No function URL defined for chain ${chainId}`)
  const response = await axios.get(`${baseUrl}/kycStatus`, {headers})
  if (isKYC(response.data)) {
    return response.data
  } else {
    throw new Error("malformed KYC response")
  }
}

export async function handler(event: HandlerParams) {
  if (!event.request || !event.request.body) throw new Error("Missing payload")

  const credentials = {...event}
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})

  const network = await signer.provider.getNetwork()
  const uniqueIdentityAddress = UNIQUE_IDENTITY_ADDRESS[network.chainId]
  assertNonNullable(uniqueIdentityAddress, "UniqueIdentity address is not defined for this network")
  const uniqueIdentity = new ethers.Contract(uniqueIdentityAddress, UniqueIdentityAbi, signer) as UniqueIdentity

  return await main({signer, headers: event.request.headers, network, uniqueIdentity})
}

export async function main({
  headers,
  signer,
  network,
  uniqueIdentity,
  fetchKYCStatus = defaultFetchKYCStatus,
}: {
  headers: Request["headers"]
  signer: Signer
  network: ethers.providers.Network
  uniqueIdentity: UniqueIdentity
  fetchKYCStatus?: FetchKYCFunction
}) {
  assertNonNullable(signer.provider)

  const forwardedHeaders = _.pick(headers, [
    "x-goldfinch-address",
    "x-goldfinch-signature",
    "x-goldfinch-signature-block-num",
  ])
  const kycStatus = await fetchKYCStatus({headers: forwardedHeaders, chainId: network.chainId})

  if (kycStatus.status !== "approved" || kycStatus.countryCode === "US" || kycStatus.countryCode === "") {
    throw new Error("Does not meet mint requirements")
  }
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNATURE_EXPIRY_IN_SECONDS
  const userAddress = forwardedHeaders["x-goldfinch-address"]
  const nonce = await uniqueIdentity.nonces(userAddress)
  const idVersion = await uniqueIdentity.ID_VERSION_0()
  const signTypes = ["address", "uint256", "uint256", "address", "uint256", "uint256"]
  const signParams = [userAddress, idVersion, expiresAt, uniqueIdentity.address, nonce, network.chainId]
  const encoded = pack(signTypes, signParams)
  const hashed = keccak256(encoded)
  const signature = await signer.signMessage(ethers.utils.arrayify(hashed))

  return {signature, expiresAt}
}

import _ from "lodash"
import {ethers, Signer} from "ethers"
import axios from "axios"
import {DefenderRelayProvider, DefenderRelaySigner} from "defender-relay-client/lib/ethers"
import {HandlerParams} from "../types"
import {
  assertNonNullable,
  isPlainObject,
  isString,
  isApprovedUSAccreditedEntity,
  isApprovedUSAccreditedIndividual,
  isApprovedNonUSEntity,
  getIDType as defaultGetIDType,
  KYC,
  Auth,
  FetchKYCFunction,
} from "@goldfinch-eng/utils"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import UniqueIdentityDeployment from "@goldfinch-eng/protocol/deployments/mainnet/UniqueIdentity.json"

export const UniqueIdentityAbi = UniqueIdentityDeployment.abi

const SIGNATURE_EXPIRY_IN_SECONDS = 3600 // 1 hour

const isStatus = (obj: unknown): obj is KYC["status"] => obj === "unknown" || obj === "approved" || obj === "failed"
const isKYC = (obj: unknown): obj is KYC => isPlainObject(obj) && isStatus(obj.status) && isString(obj.countryCode)

const API_URLS: {[key: number]: string} = {
  1: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  31337: "http://localhost:5001/goldfinch-frontends-dev/us-central1",
}

/**
 * Mapping of chain-id -> deployed address
 */
const UNIQUE_IDENTITY_ADDRESS: {[key: number]: string} = {
  1: "0xba0439088dc1e75F58e0A7C107627942C15cbb41",
}

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
  getIDType = defaultGetIDType,
}: {
  auth: any
  signer: Signer
  network: ethers.providers.Network
  uniqueIdentity: UniqueIdentity
  fetchKYCStatus?: FetchKYCFunction
  getIDType?: typeof defaultGetIDType
}) {
  assertNonNullable(signer.provider)
  auth = asAuth(auth)
  const userAddress = auth["x-goldfinch-address"]

  // accredited individuals + entities do not go through persona
  let kycStatus: KYC | undefined = undefined

  // TODO We should just do our own verification of x-goldfinch-signature here, rather than
  // rely on it being done implicitly via `fetchKYCStatus()`.

  if (
    !isApprovedUSAccreditedEntity(userAddress) &&
    !isApprovedUSAccreditedIndividual(userAddress) &&
    !isApprovedNonUSEntity(userAddress)
  ) {
    try {
      kycStatus = await fetchKYCStatus({auth, chainId: network.chainId})
    } catch (e) {
      console.error("fetchKYCStatus failed", e)
      throw new Error("fetchKYCStatus failed")
    }

    if (kycStatus.status !== "approved" || kycStatus.countryCode === "" || !kycStatus.residency) {
      throw new Error("Does not meet mint requirements")
    }
  } else {
    // TODO We should verify the x-goldfinch-signature here!
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
  console.log({signParams})
  const encoded = pack(signTypes, signParams)
  const hashed = keccak256(encoded)
  const signature = await signer.signMessage(ethers.utils.arrayify(hashed))

  return {signature, expiresAt, idVersion}
}

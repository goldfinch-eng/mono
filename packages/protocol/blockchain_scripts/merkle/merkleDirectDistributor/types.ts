/* eslint-disable @typescript-eslint/no-redeclare */

import {BigNumber} from "ethers"
import {
  genIsArrayOf,
  isArrayOfNonEmptyString,
  isNonEmptyString,
  isNumber,
  isPlainObject,
} from "@goldfinch-eng/utils/src/type"

export const FLIGHT_ACADEMY_DIRECT_GRANT_REASON = "flight_academy"
export type FLIGHT_ACADEMY_DIRECT_GRANT_REASON = typeof FLIGHT_ACADEMY_DIRECT_GRANT_REASON
export const LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON = "liquidity_provider"
export type LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON = typeof LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON
export const FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON = "flight_academy_and_liquidity_provider"
export type FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON =
  typeof FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON
export const CONTRIBUTOR_DIRECT_GRANT_REASON = "contributor"
export type CONTRIBUTOR_DIRECT_GRANT_REASON = typeof CONTRIBUTOR_DIRECT_GRANT_REASON
export const BACKER_DIRECT_GRANT_REASON = "backer"
export type BACKER_DIRECT_GRANT_REASON = typeof BACKER_DIRECT_GRANT_REASON

export type DirectGrantReason =
  | FLIGHT_ACADEMY_DIRECT_GRANT_REASON
  | LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON
  | FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON
  | BACKER_DIRECT_GRANT_REASON
export const isDirectGrantReason = (obj: unknown): obj is DirectGrantReason =>
  obj === FLIGHT_ACADEMY_DIRECT_GRANT_REASON ||
  obj === LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON ||
  obj === FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_DIRECT_GRANT_REASON ||
  obj === CONTRIBUTOR_DIRECT_GRANT_REASON ||
  obj === BACKER_DIRECT_GRANT_REASON

export type DirectGrant = {
  amount: BigNumber
}
export const isDirectGrant = (obj: unknown): obj is DirectGrant =>
  isPlainObject(obj) && BigNumber.isBigNumber(obj.amount)

export type JsonDirectGrant = {
  [K in keyof DirectGrant]: DirectGrant[K] extends BigNumber ? string : DirectGrant[K]
}
export const isJsonDirectGrant = (obj: unknown): obj is JsonDirectGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.amount)

export type AccountedDirectGrant = {
  account: string
  reason: DirectGrantReason
  grant: DirectGrant
}
export const isAccountedDirectGrant = (obj: unknown): obj is AccountedDirectGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isDirectGrantReason(obj.reason) && isDirectGrant(obj.grant)
export const isArrayOfAccountedDirectGrant = genIsArrayOf(isAccountedDirectGrant)

export type JsonAccountedDirectGrant = {
  account: string
  reason: DirectGrantReason
  grant: JsonDirectGrant
}
export const isJsonAccountedDirectGrant = (obj: unknown): obj is JsonAccountedDirectGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isDirectGrantReason(obj.reason) && isJsonDirectGrant(obj.grant)
export const isArrayOfJsonAccountedDirectGrant = genIsArrayOf(isJsonAccountedDirectGrant)

export type MerkleDirectDistributorGrantInfo = {
  index: number
  account: string
  reason: DirectGrantReason
  grant: {
    amount: string
  }
  proof: string[]
}
export const isMerkleDirectDistributorGrantInfo = (obj: unknown): obj is MerkleDirectDistributorGrantInfo =>
  isPlainObject(obj) &&
  isNumber(obj.index) &&
  isNonEmptyString(obj.account) &&
  isDirectGrantReason(obj.reason) &&
  isPlainObject(obj.grant) &&
  isNonEmptyString(obj.grant.amount) &&
  isArrayOfNonEmptyString(obj.proof)
export const isArrayOfMerkleDirectDistributorGrantInfo = genIsArrayOf(isMerkleDirectDistributorGrantInfo)

/**
 * This comprises the publicly-releasable information about the distribution of
 * rewards. It is completely sufficient for recreating the Merkle tree, and therefore
 * for verifying that the rewards distribution consists of all of, and only of, the
 * grants defined in `grants`.
 */
export type MerkleDirectDistributorInfo = {
  merkleRoot: string
  amountTotal: string
  grants: MerkleDirectDistributorGrantInfo[]
}
export const isMerkleDirectDistributorInfo = (obj: unknown): obj is MerkleDirectDistributorInfo =>
  isPlainObject(obj) &&
  isNonEmptyString(obj.merkleRoot) &&
  isNonEmptyString(obj.amountTotal) &&
  isArrayOfMerkleDirectDistributorGrantInfo(obj.grants)

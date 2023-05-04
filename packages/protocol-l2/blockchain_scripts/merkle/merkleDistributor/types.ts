/* eslint-disable @typescript-eslint/no-redeclare */

import {BigNumber} from "ethers"
import {
  genIsArrayOf,
  isArrayOfNonEmptyString,
  isNonEmptyString,
  isNumber,
  isPlainObject,
} from "@goldfinch-eng/utils/src/type"

export const CONTRIBUTOR_GRANT_REASON = "contributor"
export type CONTRIBUTOR_GRANT_REASON = typeof CONTRIBUTOR_GRANT_REASON
export const GOLDFINCH_ADVISOR_GRANT_REASON = "advisor"
export type GOLDFINCH_ADVISOR_GRANT_REASON = typeof GOLDFINCH_ADVISOR_GRANT_REASON
export const FLIGHT_ACADEMY_GRANT_REASON = "flight_academy"
export type FLIGHT_ACADEMY_GRANT_REASON = typeof FLIGHT_ACADEMY_GRANT_REASON
export const GOLDFINCH_INVESTMENT_GRANT_REASON = "goldfinch_investment"
export type GOLDFINCH_INVESTMENT_GRANT_REASON = typeof GOLDFINCH_INVESTMENT_GRANT_REASON
export const LIQUIDITY_PROVIDER_GRANT_REASON = "liquidity_provider"
export type LIQUIDITY_PROVIDER_GRANT_REASON = typeof LIQUIDITY_PROVIDER_GRANT_REASON
export const FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON = "flight_academy_and_liquidity_provider"
export type FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON =
  typeof FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON
export const BACKER_GRANT_REASON = "backer"
export type BACKER_GRANT_REASON = typeof BACKER_GRANT_REASON

export type GrantReason =
  | FLIGHT_ACADEMY_GRANT_REASON
  | GOLDFINCH_INVESTMENT_GRANT_REASON
  | LIQUIDITY_PROVIDER_GRANT_REASON
  | FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON
  | GOLDFINCH_ADVISOR_GRANT_REASON
  | CONTRIBUTOR_GRANT_REASON
  | BACKER_GRANT_REASON
export const isGrantReason = (obj: unknown): obj is GrantReason =>
  obj === FLIGHT_ACADEMY_GRANT_REASON ||
  obj === GOLDFINCH_INVESTMENT_GRANT_REASON ||
  obj === LIQUIDITY_PROVIDER_GRANT_REASON ||
  obj === FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON ||
  obj === GOLDFINCH_ADVISOR_GRANT_REASON ||
  obj === CONTRIBUTOR_GRANT_REASON ||
  obj === BACKER_GRANT_REASON

export type Grant = {
  amount: BigNumber
  vestingLength: BigNumber
  cliffLength: BigNumber
  vestingInterval: BigNumber
}
export const isGrant = (obj: unknown): obj is Grant =>
  isPlainObject(obj) &&
  BigNumber.isBigNumber(obj.amount) &&
  BigNumber.isBigNumber(obj.vestingLength) &&
  BigNumber.isBigNumber(obj.cliffLength) &&
  BigNumber.isBigNumber(obj.vestingInterval)

export type JsonGrant = {
  [K in keyof Grant]: Grant[K] extends BigNumber ? string : Grant[K]
}
export const isJsonGrant = (obj: unknown): obj is JsonGrant =>
  isPlainObject(obj) &&
  isNonEmptyString(obj.amount) &&
  isNonEmptyString(obj.vestingLength) &&
  isNonEmptyString(obj.cliffLength) &&
  isNonEmptyString(obj.vestingInterval)

export type AccountedGrant = {
  account: string
  reason: GrantReason
  grant: Grant
}
export const isAccountedGrant = (obj: unknown): obj is AccountedGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isGrantReason(obj.reason) && isGrant(obj.grant)
export const isArrayOfAccountedGrant = genIsArrayOf(isAccountedGrant)

export type JsonAccountedGrant = {
  account: string
  reason: GrantReason
  grant: JsonGrant
}
export const isJsonAccountedGrant = (obj: unknown): obj is JsonAccountedGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isGrantReason(obj.reason) && isJsonGrant(obj.grant)
export const isArrayOfJsonAccountedGrant = genIsArrayOf(isJsonAccountedGrant)

export type MerkleDistributorGrantInfo = {
  index: number
  account: string
  reason: GrantReason
  grant: {
    amount: string
    vestingLength: string
    cliffLength: string
    vestingInterval: string
  }
  proof: string[]
}
export const isMerkleDistributorGrantInfo = (obj: unknown): obj is MerkleDistributorGrantInfo =>
  isPlainObject(obj) &&
  isNumber(obj.index) &&
  isNonEmptyString(obj.account) &&
  isGrantReason(obj.reason) &&
  isPlainObject(obj.grant) &&
  isNonEmptyString(obj.grant.amount) &&
  isNonEmptyString(obj.grant.vestingLength) &&
  isNonEmptyString(obj.grant.cliffLength) &&
  isNonEmptyString(obj.grant.vestingInterval) &&
  isArrayOfNonEmptyString(obj.proof)
export const isArrayOfMerkleDistributorGrantInfo = genIsArrayOf(isMerkleDistributorGrantInfo)

/**
 * This comprises the publicly-releasable information about the distribution of
 * rewards. It is completely sufficient for recreating the Merkle tree, and therefore
 * for verifying that the rewards distribution consists of all of, and only of, the
 * grants defined in `grants`.
 */
export type MerkleDistributorInfo = {
  merkleRoot: string
  amountTotal: string
  grants: MerkleDistributorGrantInfo[]
}
export const isMerkleDistributorInfo = (obj: unknown): obj is MerkleDistributorInfo =>
  isPlainObject(obj) &&
  isNonEmptyString(obj.merkleRoot) &&
  isNonEmptyString(obj.amountTotal) &&
  isArrayOfMerkleDistributorGrantInfo(obj.grants)

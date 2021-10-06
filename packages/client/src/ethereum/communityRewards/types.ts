import {
  isPlainObject,
  isNumber,
  isNonEmptyString,
  isArrayOfNonEmptyString,
  genIsArrayOf,
} from "@goldfinch-eng/utils/src/type"

// HACK: I could not successfully get Webpack to compile TS imported from
// "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types". So here we re-define the subset
// of MerkleDistributor-related types that the client needs.

const FLIGHT_ACADEMY_GRANT_REASON = "flight_academy"
const GOLDFINCH_INVESTMENT_GRANT_REASON = "goldfinch_investment"
const LIQUIDITY_PROVIDER_GRANT_REASON = "liquidity_provider"

export type GrantReason =
  | typeof FLIGHT_ACADEMY_GRANT_REASON
  | typeof GOLDFINCH_INVESTMENT_GRANT_REASON
  | typeof LIQUIDITY_PROVIDER_GRANT_REASON
export const isGrantReason = (obj: unknown): obj is GrantReason =>
  obj === FLIGHT_ACADEMY_GRANT_REASON ||
  obj === GOLDFINCH_INVESTMENT_GRANT_REASON ||
  obj === LIQUIDITY_PROVIDER_GRANT_REASON

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

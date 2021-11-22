import {BigNumber} from "ethers"
import {genIsArrayOf, isArrayOfNonEmptyString, isNonEmptyString, isNumber, isPlainObject} from "@goldfinch-eng/utils"
import {GrantReason} from "../merkleDistributor/types"

export type DirectGrant = {
  amount: BigNumber
}
export const isDirectGrant = (obj: unknown): obj is DirectGrant =>
  isPlainObject(obj) && BigNumber.isBigNumber(obj.amount)

export type DirectGrantReason = GrantReason

export type JsonDirectGrant = {
  [K in keyof DirectGrant]: DirectGrant[K] extends BigNumber ? string : DirectGrant[K]
}
export const isJsonDirectGrant = (obj: unknown): obj is JsonDirectGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.amount)

export type AccountedDirectGrant = {
  account: string
  grant: DirectGrant
}
export const isAccountedDirectGrant = (obj: unknown): obj is AccountedDirectGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isDirectGrant(obj.grant)
export const isArrayOfAccountedDirectGrant = genIsArrayOf(isAccountedDirectGrant)

export type JsonAccountedDirectGrant = {
  account: string
  grant: JsonDirectGrant
}
export const isJsonAccountedDirectGrant = (obj: unknown): obj is JsonAccountedDirectGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isJsonDirectGrant(obj.grant)
export const isArrayOfJsonAccountedDirectGrant = genIsArrayOf(isJsonAccountedDirectGrant)

export type MerkleDirectDistributorGrantInfo = {
  index: number
  account: string
  grant: {
    amount: string
  }
  proof: string[]
}
export const isMerkleDirectDistributorGrantInfo = (obj: unknown): obj is MerkleDirectDistributorGrantInfo =>
  isPlainObject(obj) &&
  isNumber(obj.index) &&
  isNonEmptyString(obj.account) &&
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

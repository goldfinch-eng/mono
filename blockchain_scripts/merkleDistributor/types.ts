import {BigNumber} from "ethers"
import {genIsArrayOf, isNonEmptyString, isPlainObject} from "../../utils/type"

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
  grant: Grant
}
export const isAccountedGrant = (obj: unknown): obj is AccountedGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isGrant(obj.grant)
export const isArrayOfAccountedGrant = genIsArrayOf(isAccountedGrant)

export type JsonAccountedGrant = {
  account: string
  grant: JsonGrant
}
export const isJsonAccountedGrant = (obj: unknown): obj is JsonAccountedGrant =>
  isPlainObject(obj) && isNonEmptyString(obj.account) && isJsonGrant(obj.grant)
export const isArrayOfJsonAccountedGrant = genIsArrayOf(isJsonAccountedGrant)

export type MerkleDistributorGrantInfo = {
  index: number
  amount: string
  vestingLength: string
  cliffLength: string
  vestingInterval: string
  proof: string[]
}

/**
 * This comprises the publicly-releasable information about the distribution of
 * rewards. It is completely sufficient for recreating the Merkle tree, and therefore
 * for verifying that the rewards distribution consists of all of, and only of, the
 * grants defined in `grants`.
 */
export type MerkleDistributorInfo = {
  merkleRoot: string
  amountTotal: string
  grants: {
    [account: string]: MerkleDistributorGrantInfo
  }
}

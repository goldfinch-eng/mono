import {
  NON_US_ENTITY_ID_TYPE_4,
  NON_US_INDIVIDUAL_ID_TYPE_0,
  US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
  US_ENTITY_ID_TYPE_3,
} from "@goldfinch-eng/autotasks/unique-identity-signer/utils"
import {UserLoaded} from "../../ethereum/user"

// Go.goSeniorPool
export const seniorPoolAllowedUIDTypes = [
  NON_US_INDIVIDUAL_ID_TYPE_0,
  US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
  US_ENTITY_ID_TYPE_3,
  NON_US_ENTITY_ID_TYPE_4,
]

export function eligibleForSeniorPool(user: UserLoaded): boolean {
  const uidTypeToBalance = user?.info.value.uidTypeToBalance
  const hasSeniorPoolAllowedUIDTypes = seniorPoolAllowedUIDTypes.some((uidType) => !!uidTypeToBalance[uidType])
  const eligibleForSeniorPool = user?.info.value.goListed || hasSeniorPoolAllowedUIDTypes

  return !!eligibleForSeniorPool
}

import {
  NON_US_ENTITY_ID_TYPE_4,
  NON_US_INDIVIDUAL_ID_TYPE_0,
  US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
  US_ENTITY_ID_TYPE_3,
} from "@goldfinch-eng/autotasks/unique-identity-signer/utils"
import {UserLoaded} from "../../ethereum/user"

// Replica of Go.goSeniorPool
export const seniorPoolAllowedUIDTypes = [
  NON_US_INDIVIDUAL_ID_TYPE_0,
  US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
  US_ENTITY_ID_TYPE_3,
  NON_US_ENTITY_ID_TYPE_4,
]

export function eligibleForSeniorPool(user: UserLoaded | undefined): boolean {
  const goListed =
    user?.info.value.goListed ||
    user?.info.value.hasNonUSUID ||
    user?.info.value.hasNonUSEntityUID ||
    user?.info.value.hasUSAccreditedUID ||
    user?.info.value.hasUSEntityUID

  return !!goListed
}

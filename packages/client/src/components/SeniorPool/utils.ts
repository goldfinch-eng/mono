import {UserLoaded} from "../../ethereum/user"

export function eligibleForSeniorPool(user: UserLoaded | undefined): boolean {
  const goListed =
    user?.info.value.goListed ||
    user?.info.value.hasNonUSUID ||
    user?.info.value.hasNonUSEntityUID ||
    user?.info.value.hasUSAccreditedUID ||
    user?.info.value.hasUSEntityUID

  return !!goListed
}

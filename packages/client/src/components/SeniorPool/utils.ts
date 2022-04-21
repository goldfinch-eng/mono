import {UserLoaded} from "../../ethereum/user"

export function eligibleForSeniorPool(user: UserLoaded, allowedUIDTypes: number[]): boolean {
  const uidTypeToBalance = user?.info.value.uidTypeToBalance
  const hasSeniorPoolAllowedUIDTypes = allowedUIDTypes.some((uidType) => !!uidTypeToBalance[uidType])
  const eligibleForSeniorPool = user?.info.value.goListed || hasSeniorPoolAllowedUIDTypes

  return !!eligibleForSeniorPool
}

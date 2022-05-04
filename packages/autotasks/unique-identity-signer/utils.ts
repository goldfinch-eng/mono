import {KYC} from "."
import USAccreditedIndividualsList from "./USAccreditedIndividuals.json"
import USAccreditedEntitiesList from "./USAccreditedEntities.json"
import NonUSEntitiesList from "./NonUSEntities.json"

const US_COUNTRY_CODE = "US"
export const NON_US_INDIVIDUAL_ID_TYPE_0 = 0 // non-US individual
export const US_ACCREDITED_INDIVIDUAL_ID_TYPE_1 = 1 // US accredited individual
export const US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2 = 2 // US non accredited individual
export const US_ENTITY_ID_TYPE_3 = 3 // US entity
export const NON_US_ENTITY_ID_TYPE_4 = 4 // non-US entity
export const US_UID_TYPES = [
  US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
  US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2,
  US_ENTITY_ID_TYPE_3,
]
export const NON_US_UID_TYPES = [NON_US_INDIVIDUAL_ID_TYPE_0, NON_US_ENTITY_ID_TYPE_4]

export function isUSAccreditedIndividual(address: string): boolean {
  return caseInsensitiveIncludes(USAccreditedIndividualsList, address)
}

export function isUSAccreditedEntity(address: string): boolean {
  return caseInsensitiveIncludes(USAccreditedEntitiesList, address)
}

export function isNonUSEntity(address: string): boolean {
  return caseInsensitiveIncludes(NonUSEntitiesList, address)
}

export function caseInsensitiveIncludes(list: string[], element: string): boolean {
  const regexp = new RegExp(element, "i")
  return list.some((x) => x.match(regexp))
}

export function getIDType({address, kycStatus}: {address: string; kycStatus?: KYC}): number {
  let idVersion: number

  if (isUSAccreditedEntity(address)) {
    // US accredited entity
    idVersion = US_ENTITY_ID_TYPE_3
  } else if (isNonUSEntity(address)) {
    // non US entity
    idVersion = NON_US_ENTITY_ID_TYPE_4
  } else if (isUSAccreditedIndividual(address)) {
    // US accredited individual
    idVersion = US_ACCREDITED_INDIVIDUAL_ID_TYPE_1
  } else if (kycStatus?.countryCode !== US_COUNTRY_CODE) {
    // non US individual
    idVersion = NON_US_INDIVIDUAL_ID_TYPE_0
  } else if (kycStatus?.countryCode === US_COUNTRY_CODE) {
    // US non accredited individual
    idVersion = US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2
  } else {
    throw new Error("Cannot find expected UniqueIdentity idVersion")
  }

  return idVersion
}

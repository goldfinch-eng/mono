import USAccreditedIndividualsList from "./uid-json/USAccreditedIndividuals.json"
import USAccreditedEntitiesList from "./uid-json/USAccreditedEntities.json"
import NonUSEntitiesList from "./uid-json/NonUSEntities.json"
import {KycStatusResponse} from "./kycStatusTypes"

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
export const US_UID_TYPES_SANS_NON_ACCREDITED = US_UID_TYPES.filter(
  (uidType) => uidType !== US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2
)

/** Expiry time for presigned messages should be 30 minutes from the time the message is signed */
export const UNIQUE_IDENTITY_SIGNATURE_EXPIRY_TIME = 1800

export function caseInsensitiveIncludes(list: string[], element: string): boolean {
  const regexp = new RegExp(element, "i")
  return list.some((x) => x.match(regexp))
}

export function isApprovedUSAccreditedIndividual(address: string): boolean {
  return caseInsensitiveIncludes(USAccreditedIndividualsList, address)
}

export function isApprovedUSAccreditedEntity(address: string): boolean {
  return caseInsensitiveIncludes(USAccreditedEntitiesList, address)
}

export function isApprovedNonUSEntity(address: string): boolean {
  return caseInsensitiveIncludes(NonUSEntitiesList, address)
}

export function getIDType(kycResponse: KycStatusResponse): number {
  const {status, countryCode, residency} = kycResponse
  if (status !== "approved") {
    throw new Error("Not eligible for UID")
  }

  const isUsBased = countryCode === US_COUNTRY_CODE || residency === "us"

  const {type, accreditationStatus} = kycResponse

  if (type === "individual" && isUsBased && accreditationStatus === "unaccredited") {
    return US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2
  } else if (
    type === "individual" &&
    isUsBased &&
    (accreditationStatus === "approved" || accreditationStatus === "legacy")
  ) {
    return US_ACCREDITED_INDIVIDUAL_ID_TYPE_1
  } else if (type === "individual" && !isUsBased) {
    return NON_US_INDIVIDUAL_ID_TYPE_0
  } else if (type === "business" && isUsBased && accreditationStatus === "unaccredited") {
    throw new Error("Non-accredited US businesses are not eligible for UID")
  } else if (
    type === "business" &&
    isUsBased &&
    (accreditationStatus === "approved" || accreditationStatus === "legacy")
  ) {
    return US_ENTITY_ID_TYPE_3
  } else if (type === "business" && !isUsBased) {
    return NON_US_ENTITY_ID_TYPE_4
  } else {
    throw new Error(
      `userType=${type}, isUsBased=${isUsBased}, accreditationStatus=${accreditationStatus} not eligible for UID`
    )
  }
}

export type Auth = {
  "x-goldfinch-address": any
  "x-goldfinch-signature": any
  "x-goldfinch-signature-plaintext": any
  "x-goldfinch-signature-block-num": any
}

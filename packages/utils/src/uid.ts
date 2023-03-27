import USAccreditedIndividualsList from "./uid-json/USAccreditedIndividuals.json"
import USAccreditedEntitiesList from "./uid-json/USAccreditedEntities.json"
import NonUSEntitiesList from "./uid-json/NonUSEntities.json"

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

export interface KYC {
  status: "unknown" | "approved" | "failed"
  countryCode: string
  residency?: "non-us" | "us"
}

export function getIDType({address, kycStatus}: {address: string; kycStatus?: KYC}): number {
  let idVersion: number

  if (isApprovedUSAccreditedEntity(address)) {
    // US accredited entity
    idVersion = US_ENTITY_ID_TYPE_3
  } else if (isApprovedNonUSEntity(address)) {
    // non US entity
    idVersion = NON_US_ENTITY_ID_TYPE_4
  } else if (isApprovedUSAccreditedIndividual(address)) {
    // US accredited individual
    idVersion = US_ACCREDITED_INDIVIDUAL_ID_TYPE_1
  } else if (kycStatus?.countryCode !== US_COUNTRY_CODE && kycStatus?.residency !== "us") {
    // non US individual
    idVersion = NON_US_INDIVIDUAL_ID_TYPE_0
  } else if (kycStatus?.countryCode === US_COUNTRY_CODE || kycStatus?.residency === "us") {
    // US non accredited individual
    idVersion = US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2
  } else {
    throw new Error("Cannot find expected UniqueIdentity idVersion")
  }

  return idVersion
}

export type Auth = {
  "x-goldfinch-address": any
  "x-goldfinch-signature": any
  "x-goldfinch-signature-plaintext": any
  "x-goldfinch-signature-block-num": any
}

export type FetchKYCFunction = ({auth, chainId}: {auth: Auth; chainId: number}) => Promise<KYC>

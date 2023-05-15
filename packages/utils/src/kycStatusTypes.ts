export type KycStatus = "unknown" | "approved" | "failed" | "pending" | "expired"

// Possible accreditation statuses for PM users stored in our db
export type KycAccreditationStatus =
  | "pending_documents"
  | "pending_verification"
  | "expired"
  | "approved"
  | "failed"
  | "unknown"
  | "unaccredited"
  | "legacy"

// Possible identity statuses for PM users stored in our db
export type KycBusinessIdentityStatus = "approved" | "pending" | "failed"
export type KycIndividualIdentityStatus = 
  | "pending_documents"
  | "pending_verification"
  | "expired"
  | "approved"
  | "failed"
  | "legacy"
  | "unknown"
export type KycIdentityStatus = KycBusinessIdentityStatus | KycIndividualIdentityStatus

export type KycStatusResponse = {
  address: string
  status: KycStatus
  identityStatus?: KycIdentityStatus
  accreditationStatus?: KycAccreditationStatus
  countryCode: string
  residency: string
  kycProvider: "parallelMarkets" | "persona" | "none"
  type?: "individual" | "business"
  accessRevocationBy?: number
}

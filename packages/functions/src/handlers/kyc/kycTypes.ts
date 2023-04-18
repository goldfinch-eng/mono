import {KycProvider} from "../../types"

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
export type KycIdentityStatus =
  | "pending_documents"
  | "pending_verification"
  | "expired"
  | "approved"
  | "failed"
  | "legacy"
  | "unknown"

// The shape of a valid entry in the users store
export type KycItem = {
  address: string | null
  countryCode: string | null
  updatedAt: number | null
  kycProvider: KycProvider
  persona: {
    id: string | null
    status: string | null
  }
  parallelMarkets: {
    id: string | null
    type: "individual" | "business"
    accreditationStatus: KycAccreditationStatus | null
    identityStatus: KycIdentityStatus | null
    // Unix timestamp of expiry of identity documents, or null if their identity documents haven't been verified yet
    identityExpiresAt: number | null
    accreditationAccessRevocationAt: string | null
    identityAccessRevocationAt: string | null
    // Unix timestamp of expiry of accreditation documents, or null if their accreditations documents haven't been verified yet
    accreditationExpiresAt: number | null
  }
}

export type KycItemPersona = Omit<KycItem, "parallelMarkets">
export type KycItemParallelMarkets = Omit<KycItem, "persona">
export type KycItemNone = Omit<KycItem, "parallelMarkets" | "persona">

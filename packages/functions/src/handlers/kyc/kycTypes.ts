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

// Possible identity statuses for PM users stored in our db
export type KycIdentityStatus = "pending_documents" | "pending_verification" | "expired" | "approved" | "failed"

// The shape of a valid entry in the users store
export type KycItem = {
  address: string | null
  countryCode: string | null
  updatedAt: number | null
  persona: {
    id: string | null
    status: string | null
  }
  parallelMarkets: {
    id: string | null
    accreditationStatus: KycAccreditationStatus | null
    identityStatus: KycIdentityStatus | null
    accreditationAccessRevocationAt: string | null
    identityAccessRevocationAt: string | null
  }
}

export type KycItemPersona = Omit<KycItem, "parallelMarkets">
export type KycItemParallelMarkets = Omit<KycItem, "persona">

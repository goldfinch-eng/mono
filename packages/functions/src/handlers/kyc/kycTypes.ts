import {KycAccreditationStatus, KycIdentityStatus} from "@goldfinch-eng/utils"
import {KycProvider} from "../../types"

// The shape of a valid entry in the users store
export type KycItem = {
  address: string | null
  countryCode: string | null
  // residency key for PM users
  residency: string | null
  updatedAt: number | null
  kycProvider: KycProvider
  persona: {
    id: string | null
    status: string | null
  }
  // residency for persona users is stored in kyc - TODO - migrate from kyc.residency to top level residency
  kyc?: {
    residency: string
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

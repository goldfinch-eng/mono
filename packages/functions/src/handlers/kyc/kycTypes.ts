import {PmAccreditationStatus} from "../parallelmarkets/PmApiTypes"

export type KycStatus = "current" | "pending" | "expired" | "rejected"

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
    accreditation_status: PmAccreditationStatus | null
    accreditation_access_revocation_at: string | null
    identity_status: string | null
    identity_access_revocation_at: string | null
  }
}

export type KycItemPersona = Omit<KycItem, "parallelMarkets">
export type KycItemParallelMarkets = Omit<KycItem, "persona">

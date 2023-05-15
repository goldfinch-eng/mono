import {KycAccreditationStatus, KycIdentityStatus} from "@goldfinch-eng/utils"

export type Agreement = {
  // User's wallet address
  address: string
  fullName: string
  // Pool address for which they signed the agreement
  pool: string
  // Unix timestamp when they signed (includes miliseconds)
  signedAt: number
  email?: string
}

// Common fields between the Persona and Parallel Markets users
export type UserCommon<T> = {
  address: string
  countryCode?: string
  updatedAt?: number
  uidRecipientAuthorizations?: {
    [uid: string]: string
  }
  lastUidSignatureExpiresAt?: number
} & T

export type UserPersona = {
  // Older persona entries can might not have this field
  kycProvider?: "persona"
  persona: {
    id: string
    status: string
  }
  kyc?: {
    residency: string
  }
}

export type UserParallelMarkets = {
  residency?: string
  kycProvider: "parallelMarkets"
  parallelMarkets: {
    id: string
    type: "individual" | "business"
    accreditationStatus: KycAccreditationStatus
    identityStatus: KycIdentityStatus
    // Unix timestamp of expiry of identity documents, or null if their identity documents haven't been verified yet
    identityExpiresAt?: number
    accreditationAccessRevocationAt?: number
    identityAccessRevocationAt?: number
    // Unix timestamp of expiry of accreditation documents, or null if their accreditations documents haven't been verified yet
    accreditationExpiresAt?: number
  }
}

export type User = UserCommon<UserPersona | UserParallelMarkets>

export type DestroyedUserInfo = {
  burnedUidType: string
  countryCode: string
  deletedAt: number
  persona: {
    // Inquiry id
    id: string
    status: string
  }
}

export type DestroyedUser = {
  address: string
  deletions: DestroyedUserInfo[]
}

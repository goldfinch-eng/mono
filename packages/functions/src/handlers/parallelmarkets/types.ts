export type PmIdentityEvent = "data_update" | "access_revocation_scheduled"

export type PmAccreditationEvent = "data_update" | "access_revocation_scheduled"

export type PmType = "individual" | "business"

export interface PmEntity {
  id: string
  type: PmType
}

export interface PmIdentityPayload {
  entity: PmEntity
  event: PmIdentityEvent
  scope: "identity"
}

export interface PmAccreditationPayload {
  entity: PmEntity
  event: PmAccreditationEvent
  scope: "accreditation_status"
}

export type PmPayload = PmIdentityPayload | PmAccreditationPayload

export type ConsistencyLevel = "high" | "medium" | "low" | "none"
export type IdentityDocumentValidity = "valid" | "valid_maybe_expired" | "expired" | "unreadable"

export interface PmIndividualConsistencySummary {
  overall_records_level_match: ConsistencyLevel
  // If null then they have not submitted documents yet
  id_validity: IdentityDocumentValidity | null
}

export interface PmBusinessConsistencySummary {
  overall_records_level_match: ConsistencyLevel
}

// For full description of fields see https://developer.parallelmarkets.com/docs/server/data-structures#individual-identity-details
export interface PmIndividualIdentityDetails {
  birth_date: string
  citizenship_country: string
  completed_at: string
  consistency_summary: PmIndividualConsistencySummary
}

export interface PmBusinessIdentityDetails {
  business_type: string
  completed_at: string
  consistency_summary: PmBusinessConsistencySummary
}

export interface PmIndividualIdentity {
  id: string
  type: "individual"
  identity_details: PmIndividualIdentityDetails
  access_expires_at: string | null
  access_revoked_by: string | null
}

export interface PmBusinessIdentity {
  id: string
  type: "business"
  identity_details: PmBusinessIdentityDetails
  access_expires_at: string | null
  access_revoked_by: string | null
}

export type PmIdentity = PmIndividualIdentity | PmBusinessIdentity

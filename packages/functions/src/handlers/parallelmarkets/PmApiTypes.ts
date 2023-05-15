export type PmIdentityEvent =
  | "data_update"
  | "access_revocation_scheduled"
  | "adverse_media_risk_monitor_match"
  | "currently_sanctioned_risk_monitor_match"
  | "disqualified_director_risk_monitor_match"
  | "financial_regulator_risk_monitor_match"
  | "insolvent_risk_monitor_match"
  | "law_enforcement_risk_monitor_match"
  | "pep_risk_monitor_match"

export type PmAccreditationEvent = "data_update" | "access_revocation_scheduled"
export type PmProfileEvent = "data_update" | "access_revocation_scheduled"

export type PmType = "individual" | "business"

export type PmEntity = {
  id: string
  type: PmType
}

export type PmIdentityPayload = {
  entity: PmEntity
  event: PmIdentityEvent
  scope: "identity"
}

export type PmAccreditationPayload = {
  entity: PmEntity
  event: PmAccreditationEvent
  scope: "accreditation_status"
}

export type PmProfilePayload = {
  entity: PmEntity
  event: PmProfileEvent
  scope: "profile"
}

export type PmPayload = PmIdentityPayload | PmAccreditationPayload | PmProfilePayload

export type PmConsistencyLevel = "high" | "medium" | "low" | "none"
export type PmIdentityDocumentValidity = "valid" | "valid_maybe_expired" | "expired" | "unreadable"

export type PmIndividualConsistencySummary = {
  overallRecordsMatchLevel: PmConsistencyLevel
  // If null then they have not submitted documents yet
  idValidity: PmIdentityDocumentValidity | null
}

export type PmBusinessConsistencySummary = {
  overallRecordsMatchLevel: PmConsistencyLevel
}

// For full description of fields see https://developer.parallelmarkets.com/docs/server/data-structures#individual-identity-details
export type PmIndividualIdentityDetails = {
  birthDate: string
  citizenshipCountry: string
  // This will be in datetime format e.g. "2024-04-17T17:24:53Z"
  completedAt: string
  // This will be in datetime format
  expiresAt: string
  consistencySummary: PmIndividualConsistencySummary
  residenceLocation: {
    country: string
  }
}

export type PmBusinessIdentityDetails = {
  businessType: string
  // This will be in datetime format e.g. "2024-04-17T17:24:53Z"
  completedAt: string
  // This will be in datetime format
  expiresAt: string
  incorporationCountry: string
  consistencySummary: PmBusinessConsistencySummary
  principalLocation: {
    country: string
  }
}

export type PmIndividualIdentity = {
  id: string
  type: "individual"
  identityDetails: PmIndividualIdentityDetails
  accessExpiresAt?: string
  accessRevokedBy?: string
}

export type PmBusinessIdentity = {
  id: string
  type: "business"
  identityDetails: PmBusinessIdentityDetails
  accessExpiresAt?: string
  accessRevokedBy?: string
}

export type PmIdentity = PmIndividualIdentity | PmBusinessIdentity

export type PmOauthResponse = {
  accessToken: string
  tokenType: "bearer"
  expiresIn: number
  refreshToken: string
  refreshExpiresIn: number
}

export type PmProfileIndividual = {
  email: string
  firstName: string
  lastName: string
}

export type PmProfileBusiness = {
  name: string
  businessType: string
  primaryContact: PmProfileIndividual
}

export type PmProfile = PmProfileIndividual | PmProfileBusiness

export type PmProfileResponse = {
  /* A unique identifier for the subject. */
  id: string
  // / The entity type of the subject.
  type: string
  /* Profile information for the subject. */
  profile: PmProfile
  /* A unique identifier for the individual who authenticated. */
  userId: string
  /* The Individual Profile of the user who has authenticated. */
  userProfile: PmProfileIndividual
  userProvidingFor: "self" | "controlled-business" | "other-individual"
  accessExpiresAt?: string
  accessRevokedBy?: "subject" | "partner" | "system"
}

export type PmAccreditationDocument = {
  downloadUrl: string
  downloadUrlExpires: number
  type: "certification-letter"
}

export type PmAccreditationStatus =
  | "current"
  | "pending"
  | "submitter_pending"
  | "third_party_pending"
  | "expired"
  | "rejected"

export type PmAccreditationIndividual = {
  id: string
  status: PmAccreditationStatus
  expiresAt: number
  assertionType: "income" | "net-worth" | "evaluator-assertion" | "professional-license"
  createdAt: number
  certifiedAt: number
  firstName: string
  lastName: string
  documents: PmAccreditationDocument[]
}

export type PmAccreditationBusiness = {
  id: string
  status: PmAccreditationStatus
  expiresAt: number
  assertionType: "worth" | "evaluator-assertion" | "accredited-owners"
  createdAt: number
  certifiedAt: number
  name: string
  documents: PmAccreditationDocument[]
}

export type PmAccreditation<Type, Accreditations> = {
  id: string
  type: Type
  /* If the user has indicated they are not accredited, this will be the Unix timestamp of when they made that indication. */
  indicatedUnaccredited?: string
  accreditations: Accreditations[]
}

export type PmBusinessAccreditation = PmAccreditation<"business", PmAccreditationBusiness>
export type PmIndividualAccreditation = PmAccreditation<"individual", PmAccreditationIndividual>

export type PmAccreditationResponse = PmBusinessAccreditation | PmIndividualAccreditation

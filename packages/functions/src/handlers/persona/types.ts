type PersonaEvents = {
  // Incomplete list of events sourced from
  // https://docs.withpersona.com/reference/types-of-events

  // Inquiries
  "inquiry.created": Inquiry
  "inquiry.started": Inquiry
  "inquiry.expired": Inquiry
  "inquiry.transitioned": Inquiry
  "inquiry.completed": Inquiry
  "inquiry.failed": Inquiry
  "inquiry.approved": Inquiry
  "inquiry.declined": Inquiry

  // Reports
  "report/watchlist.matched": Report
  "report/watchlist.business-watchlist.matched": Report
}
export type AllEventNames = keyof PersonaEvents

export type InquiryEvents = Pick<PersonaEvents, `inquiry.${string}` & keyof PersonaEvents>
export type InquiryEventNames = keyof InquiryEvents

/**
 * Reference to a PersonaEntity.
 *
 * id - unique identifier for the corresponding PersonaEntity
 * type - type identifier for the corresponding PersonaEntity
 */
type PersonaReference<T extends AllEntityTypes> = {
  id: string
  type: T
}

/**
 * Data for a specific Entity in Persona. This could be an Inquiery, Report, Verification, or
 * any of the other types of resources that Persona surfaces.
 *
 * All Entities have a PersonaReference that uniquely identifies them.
 *
 * They also all have a unique set of attributes. Attributes may be similar across Entities, but often
 * have small differences that make combining them into a single type impractical.
 *
 * Along with attributes, Entities may have relationships to other Entities within Persona. All
 * relationships are denoted as PersonaReferences, with extra API calls required to get the data.
 */
export type PersonaEntity<Type extends AllEntityTypes, Attributes> = PersonaReference<Type> & {
  attributes: Attributes
  relationships: {
    account?: {
      data?: PersonaReference<AccountTypes>
    }
    inquiry?: {
      data?: PersonaReference<InquiryTypes>
    }
    reports?: {
      data: PersonaReference<ReportTypes>[]
    }
    verifications?: {
      data: PersonaReference<VerificationTypes>[]
    }
    documents?: {
      data: PersonaReference<DocumentTypes>[]
    }
  }
}

type AccountTypes = "account"
export type Account = PersonaEntity<
  AccountTypes,
  {
    referenceId: string
    countryCode: string
    createdAt: string
    updatedAt: string
  }
>

type InquiryTypes = "inquiry"
type Inquiry = PersonaEntity<
  InquiryTypes,
  {
    status:
      | "created" // individual started the inquiry
      | "pending" // verification info has been submitted
      | "completed" // all required verifications have been passed
      | "approved" // optional status applied by custom logic
      | "declined" // optional status applied by custom logic
      | "expired" // inquiry not completed within 24 hours
      | "failed" // exceeded allowed number of verification attempts
    subject?: string
    referenceId?: string
    createdAt: string
    startedAt?: string
    completedAt?: string
    failedAt?: string
    expiredAt?: string
    redactedAt?: string
    emailAddress?: string
  }
>

type ReportTypes = "report/watchlist" | "report/politically-exposed-person"
export type Report = PersonaEntity<
  ReportTypes,
  {
    status: "ready" | string
    createdAt: string
    completedAt: string
    redactedAt?: string
    hasMatch: boolean
  }
>

type VerificationTypes =
  | "verification/government-id"
  | "verification/document"
  | "verification/database"
  | "verification/selfie"
type Verification = PersonaEntity<
  VerificationTypes,
  {
    // https://docs.withpersona.com/docs/verifications-reference
    status:
      | "initiated" // Verification has started
      | "confirmed" // Specific to PhoneNumber verifications where they verified the sent confirmation code
      | "submitted" // Data submitted and frozen, processing has begun
      | "passed"
      | "failed"
      | "requires_retry" // Checks could not be fully processed
    createdAt: string
    completedAt: string
    countryCode: string
    idClass: string
  }
>

type DocumentTypes = "document/generic" | "document/government-id"
type Document = PersonaEntity<
  DocumentTypes,
  {
    status: "ready" | "processed" | string
    kind: "proof_of_employment" | string
    idClass: string
    createdAt: string
  }
>

export type AllEntityTypes = AccountTypes | InquiryTypes | ReportTypes | DocumentTypes | VerificationTypes
export type AllEntities = Account | Inquiry | Report | Verification | Document

type EntityFromType<T extends AllEntityTypes, U extends AllEntities> = U["type"] extends T ? U : never

export const isSpecificEntity = <T extends AllEntityTypes, U extends AllEntities>(
  entity: AllEntities,
  type: T,
): entity is EntityFromType<T, U> => {
  return entity.type === type
}

export const entityPredicate = <T extends AllEntityTypes, U extends AllEntities>(type: T) => {
  return (entity: AllEntities): entity is EntityFromType<T, U> => {
    return isSpecificEntity(entity, type)
  }
}

export const isAccount = entityPredicate<AccountTypes, Account>("account")
export const isVerification = (type: VerificationTypes) => entityPredicate<VerificationTypes, Verification>(type)

/**
 * Request sent from Persona via webhooks. All requests have a name that describes the type of the
 * data in the payload.
 *
 * Payloads also contain an array of "included" Entities that are related to the main Entity in some
 * way. It is unclear from the API definition if these "included" Entites must also appear in the main
 * Entity's relationships field.
 */
export type PersonaEventRequest<Name extends AllEventNames> = {
  data: {
    attributes: {
      name: Name
      payload: {
        data: PersonaEvents[Name]
        included: AllEntities[]
      }
      createdAt: string
    }
  }
}

/** A general, as-yet-untyped Persona webhook event */
export type GeneralPersonaEventRequest = PersonaEventRequest<AllEventNames>

export const isInquiryEvent = (req: GeneralPersonaEventRequest): req is PersonaEventRequest<InquiryEventNames> => {
  return req.data.attributes.name.startsWith("inquiry")
}

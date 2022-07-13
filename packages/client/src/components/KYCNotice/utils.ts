import {US_ACCREDITED_INDIVIDUAL_ID_TYPE_1, US_ENTITY_ID_TYPE_3, US_UID_TYPES} from "@goldfinch-eng/utils"
import {GeolocationData} from "../../App"
import {UserLoaded} from "../../ethereum/user"
import {SENIOR_POOL_AGREEMENT_NON_US_ROUTE, SENIOR_POOL_AGREEMENT_US_ROUTE} from "../../types/routes"
import {US_COUNTRY_CODE} from "../VerifyIdentity/constants"

export const US_TITLE = "This offering is only available to accredited U.S. persons."
export const US_MESSAGE =
  "This offering is only available to accredited U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom."

export const NON_US_TITLE = "This offering is only available to non-U.S. persons."
export const NON_US_MESSAGE =
  "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."

export function getLegalLanguage({
  user,
  allowedUIDTypes,
  geolocation,
}: {
  user: UserLoaded | undefined
  allowedUIDTypes: Array<number>
  geolocation: GeolocationData | undefined
}) {
  let title = NON_US_TITLE
  let message = NON_US_MESSAGE
  let seniorPoolLegalRoute = SENIOR_POOL_AGREEMENT_NON_US_ROUTE

  // If this is a Pool (tranchedpool or seniorpool) that allows US investors
  // && (US IP address || have a US accreddited/entity UID)
  const isUSEnabled = allowedUIDTypes.some((r) => US_UID_TYPES.includes(r))
  if (
    isUSEnabled &&
    (geolocation?.country === US_COUNTRY_CODE ||
      [US_ACCREDITED_INDIVIDUAL_ID_TYPE_1, US_ENTITY_ID_TYPE_3].some((x) => !!user?.info.value.uidTypeToBalance[x]))
  ) {
    title = US_TITLE
    message = US_MESSAGE
    seniorPoolLegalRoute = SENIOR_POOL_AGREEMENT_US_ROUTE
  }

  return {title, message, seniorPoolLegalRoute}
}

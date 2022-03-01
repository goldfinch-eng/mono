import {useState} from "react"
import {UserLoaded} from "../ethereum/user"
import useGeolocation from "../hooks/useGeolocation"
import {iconCarrotDown, iconCarrotUp, iconInfo} from "./icons"
import {US_COUNTRY_CODE} from "./VerifyIdentity/constants"

export default function InvestorNotice({user}: {user: UserLoaded | undefined}) {
  const geolocation = useGeolocation()
  const [open, setOpen] = useState<boolean>(false)
  let title, message
  if (
    geolocation?.country === US_COUNTRY_CODE ||
    user?.info.value.hasUSAccreditedUID ||
    user?.info.value.hasUSEntityUID
  ) {
    title = "This offering is only available to accredited U.S. persons."
    message =
      "This offering is only available to accredited U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom."
  } else if (
    geolocation?.country !== US_COUNTRY_CODE ||
    user?.info.value.hasNonUSUID ||
    user?.info.value.hasNonUSEntityUID
  ) {
    title = "This offering is only available to non-U.S. persons."
    message =
      "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."
  }

  return (
    <div className="investor-notice info-banner subtle background-container" onClick={() => setOpen(!open)}>
      <div className="inner-banner">
        <div className="message">
          {iconInfo}
          <p>{title}</p>
        </div>
        {open ? (
          <button className="expand close">{iconCarrotUp}</button>
        ) : (
          <button className="expand open">{iconCarrotDown}</button>
        )}
      </div>
      <div className={`hidden-message ${open ? "show" : "hide"}`}>{message}</div>
    </div>
  )
}

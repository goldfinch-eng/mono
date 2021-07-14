import React, {useState} from "react"
import useGeolocation from "../hooks/useGeolocation"
import {iconInfo, iconX} from "./icons"

export default function InvestorNotice() {
  const geolocation = useGeolocation()
  const [open, setOpen] = useState<boolean>(false)

  if (!geolocation) {
    return <div className="investor-notice info-banner background-container">Loading...</div>
  }

  let message: string, hiddenMessage: string
  if (geolocation.country === "US") {
    message = "This offering is only available to U.S. Accredited Investors."
    hiddenMessage =
      "This offering is only available to U.S. persons who qualify as an Accredited Investor. This offering has not been registered under the U.S.Securities Act of 1933(the “Securities Act”), as amended, or under the securities laws of certain states, and may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom."
  } else {
    message = "This offering is only available to non-U.S. persons."
    hiddenMessage =
      "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements If you are a U.S. person and qualify as an Accredited Investor, you can verify your address."
  }

  return (
    <div className="investor-notice info-banner background-container">
      <div className="inner-banner">
        <div className="message">
          {iconInfo}
          <p>{message}</p>
        </div>
        {open ? (
          <button className="learn-more close" onClick={() => setOpen(false)}>
            <span>Close</span>
            {iconX}
          </button>
        ) : (
          <button className="learn-more" onClick={() => setOpen(true)}>
            Learn more
          </button>
        )}
      </div>
      <div className={`hidden-message ${open ? "show" : "hide"}`}>{hiddenMessage}</div>
    </div>
  )
}

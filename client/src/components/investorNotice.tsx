import React, { useState, useEffect, useContext } from "react"
import Dropdown, { DropdownOption } from "./dropdown"
import { iconInfo } from "./icons"
import useGeolocation from "../hooks/useGeolocation"

function InvestorNotice() {
  let geolocation = useGeolocation()

  if (!geolocation) {
    return (
      <div className="investor-notice">
        <button>Loading...</button>
      </div>
    )
  }

  let options: DropdownOption[]
  if (geolocation.country === "US") {
    options = [
      {
        value: "notice",
        selectedEl: (
          <button className="button">
            {iconInfo} <span>U.S.</span>
          </button>
        ),
        el: (
          <div className="investor-notice-content">
            <div className="font-bold">Notice</div>
            <div>
              This offering is only available to U.S. persons who qualify as an Accredited Investor. This offering has
              not been registered under the U.S. Securities Act of 1933 (the “Securities Act”), as amended, or under the
              securities laws of certain states, and may not be offered, sold or otherwise transferred, pledged or
              hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to
              an effective registration statement or an exemption therefrom.
            </div>
          </div>
        ),
      },
    ]
  } else {
    options = [
      {
        value: "notice",
        selectedEl: (
          <button className="button">
            {iconInfo} <span>Non-U.S.</span>
          </button>
        ),
        el: (
          <div className="investor-notice-content">
            <div className="font-bold">Notice</div>
            <div>
              This offering is only available to non-U.S. persons. This offering has not been registered under the U.S.
              Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States
              or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration
              or an applicable exemption from the registration requirements If you are a U.S. person and qualify as an
              Accredited Investor, you can verify your address.{" "}
            </div>
          </div>
        ),
      },
    ]
  }

  return <Dropdown className="investor-notice" options={options} highlightSelected={false} arrow={false} />
}

export default InvestorNotice

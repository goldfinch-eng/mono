import React, {useEffect, useState} from "react"
import {iconOutArrow, iconX} from "./icons"

function NdaPrompt({show, onClose, onSign}) {
  const [checkAgreement, setCheckAgreement] = useState(false)

  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
  }, [show])

  return (
    <div className={`overlay nda-prompt ${!show && "hidden"}`}>
      <div className="overlay-content">
        <h1>Non-Disclosure Agreement</h1>
        <p>
          To access more information about this and other borrower pools, you must agree to keep this information
          confidential.
        </p>
        <div className="checkbox-container">
          <input
            className="checkbox"
            type="checkbox"
            name="agreement"
            id="agreement"
            checked={checkAgreement}
            onChange={() => setCheckAgreement(!checkAgreement)}
          />
          <label className="checkbox-label" htmlFor="agreement">
            <div>
              I agree to the&nbsp;
              <a className="checkbox-label-link" href="/non-disclosure-agreement" target="_blank">
                Non-Disclosure Agreement
              </a>
              &nbsp;for all Goldfinch borrower pools.
            </div>
          </label>
        </div>
        <button
          className={`button right-icon ${!checkAgreement && "disabled"}`}
          disabled={!checkAgreement}
          onClick={() => onSign()}
        >
          View{iconOutArrow}
        </button>
        <button className="close-button" onClick={() => onClose()}>
          {iconX}
        </button>
      </div>
    </div>
  )
}

export default NdaPrompt

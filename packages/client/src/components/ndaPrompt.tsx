import React from "react"
import {iconOutArrow, iconX} from "./icons.js"

function NdaPrompt(props) {
  return (
    <div className="overlay nda-prompt">
      <div className="overlay-content">
        <h1>Non-Disclosure Agreement</h1>
        <p>
          To access more information about this and other borrower pools, you must agree to keep this information
          confidential.
        </p>
        <div className="checkbox-container">
          <input className="checkbox" type="checkbox" name="agreement" id="agreement" />
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
        <button className="button right-icon">View{iconOutArrow}</button>
        <button className="close-button">{iconX}</button>
      </div>
    </div>
  )
}

export default NdaPrompt

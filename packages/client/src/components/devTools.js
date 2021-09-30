import React from "react"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import {iconCircleCheck, iconX, iconDownArrow} from "./icons.js"

export default function DevTools(props) {
  const {open: showDevTools, setOpen: setShowDevTools} = useCloseOnClickOrEsc()

  function toggleDevTools() {
    if (showDevTools === "") {
      setShowDevTools("open")
    } else {
      setShowDevTools("")
    }
  }
  return (
    <div className={`devTools ${showDevTools}`}>
      {!showDevTools && <div onClick={toggleDevTools}>Dev Tools</div>}
      {showDevTools && (
        <div className="content-container">
          <div className="header">
            <h2>Dev Tools</h2>
            <button className="close light outbound-link" onClick={toggleDevTools}>
              {iconX}
            </button>
          </div>
          <div className="actions">
            <button className="button dark">Fund account</button>
            <button className="button dark">Pay All</button>
            <button className="button dark">Pay All</button>
            <button className="button dark">Pay All</button>
          </div>
        </div>
      )}
    </div>
  )
}

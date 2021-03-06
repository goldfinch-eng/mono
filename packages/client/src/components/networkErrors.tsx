import React, {useContext} from "react"
import {iconX} from "./icons"
import {AppContext} from "../App"
import {assertNonNullable} from "../utils"

function NetworkErrors(props) {
  const {networkMonitor} = useContext(AppContext)

  function errorItem(error) {
    assertNonNullable(networkMonitor)
    return (
      <div key={error.id} className="error-item">
        <div className="error-label">Error</div>
        <div
          onClick={() => {
            networkMonitor.removeError(error)
          }}
          className="dismiss-error-item"
        >
          {iconX}
        </div>
        <p>{error.message}</p>
      </div>
    )
  }

  if (!props.currentErrors.length) {
    return <></>
  } else {
    return <div className="error-items">{props.currentErrors.map(errorItem)}</div>
  }
}

export default NetworkErrors

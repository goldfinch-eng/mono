import {useContext, useState} from "react"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import {iconX} from "./icons.js"
import LoadingButton from "./loadingButton"
import {AppContext} from "../App"

export default function DevTools(props) {
  const {open: showDevTools, setOpen: setShowDevTools} = useCloseOnClickOrEsc()

  const {user} = useContext(AppContext)
  const [disabled, setDisabled] = useState(0)

  function toggleDevTools() {
    if (showDevTools === "") {
      setShowDevTools("open")
    } else {
      setShowDevTools("")
    }
  }
  return (
    <div
      className={`devTools ${showDevTools}`}
      onClick={() => {
        if (!showDevTools) {
          toggleDevTools()
        }
      }}
    >
      {!showDevTools && <div onClick={toggleDevTools}>Dev Tools</div>}
      {showDevTools && (
        <div className="content-container">
          <div className="header">
            <h2>Goldfinch Dev Tools</h2>
            <button className="close light outbound-link" onClick={toggleDevTools}>
              {iconX}
            </button>
          </div>
          <div className="actions">
            <button
              className={`button dark ${disabled ? "disabled" : ""}`}
              disabled={disabled}
              onClick={async (e) => {
                e.preventDefault()
                setDisabled(true)
                await fetch("/fundWithWhales", {
                  method: "POST",
                  headers: {"Content-Type": "application/json"},
                  body: JSON.stringify({
                    address: user.address,
                  }),
                })
                setDisabled(false)
              }}
            >
              Fund account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

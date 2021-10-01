import {useContext} from "react"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import {iconX} from "./icons.js"
import {AppContext} from "../App"

export default function DevTools(props) {
  const {open: showDevTools, setOpen: setShowDevTools} = useCloseOnClickOrEsc()

  const {user} = useContext(AppContext)

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
              className="button dark"
              onClick={async () => {
                await fetch("/fundWithWhales", {
                  method: "POST",
                  headers: {"Content-Type": "application/json"},
                  body: JSON.stringify({
                    address: user.address,
                  }),
                })
              }}
            >
              Fund account
            </button>
            <button className="button dark">Button number 2</button>
            <button className="button dark">Button three</button>
            <button className="button dark">Button four</button>
          </div>
        </div>
      )}
    </div>
  )
}

import {useContext, useState} from "react"
import useCloseOnClickOrEsc from "../../hooks/useCloseOnClickOrEsc"
import {iconX} from "..//icons"
import {AppContext} from "../../App"
import {UserLoaded} from "../../ethereum/user"
import DevToolsButton from "./DevToolsButton"
import SetKycStatus from "./SetKycStatus"
import SetUserAddress from "./SetUserAddress"

export default function DevTools() {
  const {open: showDevTools, setOpen: setShowDevTools} = useCloseOnClickOrEsc()

  const {user} = useContext(AppContext)
  const [disabled, setDisabled] = useState<boolean>(false)
  const [panel, setPanel] = useState<"default" | "kyc" | "setUserAddress">("default")

  function toggleDevTools() {
    if (showDevTools === "") {
      setShowDevTools("open")
    } else if (panel !== "default") {
      setPanel("default")
    } else {
      setShowDevTools("")
    }
  }

  function renderPanel(user: UserLoaded) {
    if (panel === "default") {
      return (
        <div className="actions">
          <DevToolsButton
            disabled={disabled}
            setDisabled={setDisabled}
            onClick={async () =>
              fetch("/setupForTesting", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                  address: user.address,
                }),
              })
            }
          >
            setupForTesting
          </DevToolsButton>
          <DevToolsButton
            disabled={disabled}
            setDisabled={setDisabled}
            onClick={async () =>
              fetch("/fundWithWhales", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                  address: user.address,
                }),
              })
            }
          >
            fundWithWhales
          </DevToolsButton>
          <DevToolsButton
            disabled={disabled}
            setDisabled={setDisabled}
            onClick={async () =>
              fetch("/advanceTimeOneDay", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
              })
            }
          >
            advanceTimeOneDay
          </DevToolsButton>
          <DevToolsButton
            disabled={disabled}
            setDisabled={setDisabled}
            onClick={async () =>
              fetch("/advanceTimeThirtyDays", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
              })
            }
          >
            advanceTimeThirtyDays
          </DevToolsButton>
          <DevToolsButton disabled={disabled} setDisabled={setDisabled} onClick={async () => setPanel("kyc")}>
            KYC
          </DevToolsButton>
          <DevToolsButton
            disabled={disabled}
            setDisabled={setDisabled}
            onClick={async () => setPanel("setUserAddress")}
          >
            setUserAddress
          </DevToolsButton>
          <DevToolsButton
            disabled={disabled}
            setDisabled={setDisabled}
            onClick={async () => {
              const prefix = "http://127.0.0.1:3000/pools/"
              if (window.location.href.startsWith(prefix)) {
                const tranchedPoolAddress = window.location.href.slice(prefix.length)
                fetch("/lockTranchedPool", {
                  method: "POST",
                  headers: {"Content-Type": "application/json"},
                  body: JSON.stringify({
                    tranchedPoolAddress,
                  }),
                })
              }
            }}
          >
            lockTranchedPool
          </DevToolsButton>
        </div>
      )
    } else if (panel === "kyc") {
      return <SetKycStatus></SetKycStatus>
    } else if (panel === "setUserAddress") {
      return <SetUserAddress></SetUserAddress>
    }

    return
  }

  return user ? (
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
          {renderPanel(user)}
        </div>
      )}
    </div>
  ) : null
}

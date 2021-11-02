import {PropsWithChildren, useContext, useState} from "react"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import {iconX} from "./icons"
import {AppContext} from "../App"
import {useForm} from "react-hook-form"
import useNonNullContext from "../hooks/useNonNullContext"

function SetKycStatus() {
  const formMethods = useForm({mode: "onChange"})
  const {handleSubmit, register} = formMethods
  const {user} = useNonNullContext(AppContext)
  const [disabled, setDisabled] = useState<boolean>(false)

  return (
    <form>
      <input type="hidden" defaultValue={user.address} name="address" ref={(ref) => register(ref)} />
      <label htmlFor="countryCode">Country code</label>
      <input name="countryCode" id="countryCode" type="text" ref={(ref) => register(ref)} />
      <label htmlFor="kycStatus">KYC status</label>
      <select name="kycStatus" id="kycStatus" ref={(ref) => register(ref)}>
        <option value="approved">approved</option>
        <option value="failed">failed</option>
        <option value="unknown">unknown</option>
      </select>
      <DevToolsButton
        disabled={disabled}
        setDisabled={setDisabled}
        onClick={async () => {
          handleSubmit(
            async (data) => {
              setDisabled(true)
              await fetch("/kycStatus", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(data),
              })
              setDisabled(false)
            },
            (errors) => {
              console.log("errors", errors)
            }
          )()
        }}
      >
        Set
      </DevToolsButton>
    </form>
  )
}

function DevToolsButton({
  disabled,
  setDisabled,
  onClick,
  children,
}: PropsWithChildren<{
  disabled: boolean
  setDisabled: React.Dispatch<React.SetStateAction<boolean>>
  onClick: () => Promise<any>
}>) {
  return (
    <button
      className={`button dark ${disabled ? "disabled" : ""}`}
      disabled={disabled}
      onClick={async (e) => {
        e.preventDefault()
        setDisabled(true)
        await onClick()
        setDisabled(false)
      }}
    >
      {children}
    </button>
  )
}

export default function DevTools(props) {
  const {open: showDevTools, setOpen: setShowDevTools} = useCloseOnClickOrEsc()

  const {user} = useContext(AppContext)
  const [disabled, setDisabled] = useState<boolean>(false)
  const [panel, setPanel] = useState<"default" | "kyc">("default")

  function toggleDevTools() {
    if (showDevTools === "") {
      setShowDevTools("open")
    } else if (panel !== "default") {
      setPanel("default")
    } else {
      setShowDevTools("")
    }
  }

  function renderPanel() {
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
          <DevToolsButton disabled={disabled} setDisabled={setDisabled} onClick={async () => setPanel("kyc")}>
            KYC
          </DevToolsButton>
        </div>
      )
    } else if (panel === "kyc") {
      return <SetKycStatus></SetKycStatus>
    }

    return
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
          {renderPanel()}
        </div>
      )}
    </div>
  )
}

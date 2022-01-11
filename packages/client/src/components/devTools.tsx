import {PropsWithChildren, useContext, useState} from "react"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import {iconX} from "./icons"
import {AppContext} from "../App"
import {useForm} from "react-hook-form"
import useNonNullContext from "../hooks/useNonNullContext"
import {UserLoaded} from "../ethereum/user"

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

function SetUserAddress() {
  const formMethods = useForm({mode: "onChange"})
  const {handleSubmit, register} = formMethods
  const [disabled, setDisabled] = useState<boolean>(false)

  return (
    <form>
      <label htmlFor="overrideAddress">Wallet Address</label>
      <input name="overrideAddress" id="overrideAddress" type="text" ref={(ref) => register(ref)} />
      <DevToolsButton
        disabled={disabled}
        setDisabled={setDisabled}
        onClick={async () => {
          handleSubmit(
            async (data) => {
              setDisabled(true)
              ;(window as any).setUserAddress(data.overrideAddress)
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

function BecomeUser() {
  const formMethods = useForm({mode: "onChange"})
  const {handleSubmit, register} = formMethods
  const [disabled, setDisabled] = useState<boolean>(false)

  return (
    <form>
      <div className="actions">
        <DevToolsButton
          disabled={disabled}
          setDisabled={setDisabled}
          onClick={async () => {
            handleSubmit(
              async (data) => {
                setDisabled(true)
                ;(window as any).setUserAddress("0xf6f62bab35907565c5ad3d4c1093b7f90762c021")
                setDisabled(false)
              },
              (errors) => {
                console.log("errors", errors)
              }
            )()
          }}
        >
          Senior Pool Whale
        </DevToolsButton>
        <DevToolsButton
          disabled={disabled}
          setDisabled={setDisabled}
          onClick={async () => {
            handleSubmit(
              async (data) => {
                setDisabled(true)
                ;(window as any).setUserAddress("0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC")
                setDisabled(false)
              },
              (errors) => {
                console.log("errors", errors)
              }
            )()
          }}
        >
          Aspire
        </DevToolsButton>
        <DevToolsButton
          disabled={disabled}
          setDisabled={setDisabled}
          onClick={async () => {
            handleSubmit(
              async (data) => {
                setDisabled(true)
                ;(window as any).setUserAddress("0x8652854C25bd553d522d118AC2bee6FFA3Cce317")
                setDisabled(false)
              },
              (errors) => {
                console.log("errors", errors)
              }
            )()
          }}
        >
          QuickCheck
        </DevToolsButton>
        <DevToolsButton
          disabled={disabled}
          setDisabled={setDisabled}
          onClick={async () => {
            handleSubmit(
              async (data) => {
                setDisabled(true)
                ;(window as any).setUserAddress("0x4bBD638eb377ea00b84fAc2aA24A769a1516eCb6")
                setDisabled(false)
              },
              (errors) => {
                console.log("errors", errors)
              }
            )()
          }}
        >
          Alma
        </DevToolsButton>
      </div>
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
          <DevToolsButton disabled={disabled} setDisabled={setDisabled} onClick={async () => setPanel("becomeUser")}>
            becomeUser
          </DevToolsButton>
        </div>
      )
    } else if (panel === "kyc") {
      return <SetKycStatus></SetKycStatus>
    } else if (panel === "setUserAddress") {
      return <SetUserAddress></SetUserAddress>
    } else if (panel === "becomeUser") {
      return <BecomeUser></BecomeUser>
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

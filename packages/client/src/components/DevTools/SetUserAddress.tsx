import {useState} from "react"
import {useForm} from "react-hook-form"
import DevToolsButton from "./DevToolsButton"

export default function SetUserAddress() {
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
        <DevToolsButton
          disabled={disabled}
          setDisabled={setDisabled}
          onClick={async () => {
            handleSubmit(
              async (data) => {
                setDisabled(true)
                ;(window as any).setUserAddress("0x6a445E9F40e0b97c92d0b8a3366cEF1d67F700BF")
                setDisabled(false)
              },
              (errors) => {
                console.log("errors", errors)
              }
            )()
          }}
        >
          Active LP
        </DevToolsButton>
      </div>

      <br />
      <br />
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

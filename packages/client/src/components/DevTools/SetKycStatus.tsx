import {useState} from "react"
import {AppContext} from "../../App"
import {useForm} from "react-hook-form"
import useNonNullContext from "../../hooks/useNonNullContext"
import DevToolsButton from "./DevToolsButton"

export default function SetKycStatus() {
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

import {useHistory} from "react-router-dom"
import {iconInfo} from "./icons.js"
import {useForm, FormProvider} from "react-hook-form"
import LoadingButton from "./loadingButton"

export default function VerifyAddressBanner() {
  let history = useHistory()
  const formMethods = useForm()

  function verifyAddress(): Promise<void> {
    history.push("/verify")
    return Promise.resolve()
  }

  let qualifyText =
    "This offering is only available to non-U.S. persons. To participate, you must first verify your address."

  return (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container">
        <div className="message">
          {iconInfo}
          <p>{qualifyText}</p>
        </div>
        <LoadingButton action={verifyAddress} text="Verify Address" />
      </div>
    </FormProvider>
  )
}

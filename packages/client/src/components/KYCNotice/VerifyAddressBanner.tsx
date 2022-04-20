import {useHistory} from "react-router-dom"
import {iconInfo} from "../icons"
import {useForm, FormProvider} from "react-hook-form"
import LoadingButton from "../loadingButton"

export default function VerifyAddressBanner() {
  let history = useHistory()
  const formMethods = useForm()

  function verifyAddress(): Promise<void> {
    history.push("/verify")
    return Promise.resolve()
  }

  return (
    <FormProvider {...formMethods}>
      <div className="info-banner background-container">
        <div className="message small">
          {iconInfo}
          <p>This pool is disabled for unverified addresses. You must first verify your address.</p>
        </div>
        <LoadingButton action={verifyAddress} text="Verify Address" />
      </div>
    </FormProvider>
  )
}

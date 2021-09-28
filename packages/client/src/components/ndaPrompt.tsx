import React, {useEffect} from "react"
import {ErrorMessage} from "@hookform/error-message"
import {FormProvider, useForm} from "react-hook-form"
import {iconOutArrow, iconX} from "./icons"
import LoadingButton from "./loadingButton"

function NdaPrompt({show, onClose, onSign}) {
  const formMethods = useForm()

  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
  }, [show])

  return (
    <div className={`overlay nda-prompt ${!show && "hidden"}`}>
      <div className="overlay-content">
        <FormProvider {...formMethods}>
          <h1>Non-Disclosure Agreement</h1>
          <p>
            To access more information about this and other borrower pools, you must agree to keep this information
            confidential.
          </p>
          <div className="checkbox-container">
            <input
              className="checkbox"
              type="checkbox"
              name="agreement"
              id="agreement"
              ref={(ref) => formMethods.register(ref, {required: "You must agree to the Non-Disclosure Agreement."})}
            />
            <label className="checkbox-label" htmlFor="agreement">
              <div>
                I agree to the&nbsp;
                <a className="checkbox-label-link" href="/non-disclosure-agreement" target="_blank">
                  Non-Disclosure Agreement
                </a>
                &nbsp;for all Goldfinch borrower pools.
              </div>
            </label>
            <div className="form-input-note">
              <ErrorMessage errors={formMethods.errors} name="agreement" />
            </div>
          </div>
          <LoadingButton className="button right-icon" action={onSign} text={<>View{iconOutArrow}</>} />
          <button className="close-button" onClick={() => onClose()}>
            {iconX}
          </button>
        </FormProvider>
      </div>
    </div>
  )
}

export default NdaPrompt

import React, {useState} from "react"
import {useFormContext} from "react-hook-form"

function LoadingButton(props) {
  const [isPending, setIsPending] = useState(false)
  const formMethods = useFormContext()

  let buttonText = props.text || "Submit"
  if (isPending) {
    buttonText = "Submitting..."
  }

  return (
    <button
      type="button"
      onClick={formMethods.handleSubmit(data => {
        setIsPending(true)
        return props
          .action(data)
          .then(() => setIsPending(false))
          .catch(error => setIsPending(false))
      })}
      disabled={props.disabled}
      className={`button submit-form ${isPending ? "pending" : ""} ${props.disabled ? "disabled" : ""}`}
    >
      {buttonText}
    </button>
  )
}

export default LoadingButton

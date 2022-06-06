import React, {useState} from "react"
import {useFormContext} from "react-hook-form"

type LoadingButtonProps = {
  action: (data: any) => Promise<void>
  text?: string | React.ReactNode
  disabled?: boolean
  className?: string
  // Hacky solution to get the temporary Zapper UI layout correct
  // without affecting the other components that use this.
  marginTop?: string
}

function LoadingButton(props: LoadingButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const formMethods = useFormContext()

  let buttonText = props.text || "Submit"
  if (isPending) {
    buttonText = "Submitting..."
  }

  const style = props.marginTop ? {marginTop: props.marginTop} : {}

  return (
    <button
      style={style}
      type="button"
      onClick={formMethods.handleSubmit((data) => {
        setIsPending(true)
        return props
          .action(data)
          .then(() => setIsPending(false))
          .catch((error) => setIsPending(false))
      })}
      disabled={props.disabled}
      className={`button submit-form ${isPending ? "pending" : ""} ${props.disabled ? "disabled" : ""} ${
        props.className || ""
      }`}
    >
      {buttonText}
    </button>
  )
}

export default LoadingButton

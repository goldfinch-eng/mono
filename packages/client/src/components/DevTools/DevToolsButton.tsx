import {PropsWithChildren} from "react"

export default function DevToolsButton({
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

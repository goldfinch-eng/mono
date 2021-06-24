import { useState, useRef, useEffect, useCallback } from "react"

function useCloseOnClickOrEsc<T extends HTMLElement>(
  opts: { closeOnEsc?: boolean; closeFormFn?: () => void; closeOnClick?: boolean } = {},
): { node: React.RefObject<T>; open: string; setOpen: (s: string) => void } {
  const node = useRef<T>(null)
  const handleEscFunction = useCallback(
    event => {
      if (opts.closeOnEsc === false) {
        return
      }
      if (event.keyCode === 27) {
        if (opts.closeFormFn) {
          // If an input has focus, then don't close the form, unfocus it first
          if (document.activeElement && document.activeElement.tagName === "INPUT") {
            ;(document.activeElement as HTMLElement).blur()
          } else {
            opts.closeFormFn()
          }
        } else {
          setOpen("")
        }
      }
    },
    [opts],
  )

  const [open, setOpen] = useState<string>("")

  const handleClickOutside = useCallback(
    e => {
      if (!node.current || node.current.contains(e.target) || opts.closeOnClick === false) {
        // inside click
        return
      }
      // outside click
      if (opts.closeFormFn) {
        opts.closeFormFn()
      } else {
        setOpen("")
      }
    },
    [opts],
  )

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscFunction, false)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscFunction, false)
    }
  }, [handleClickOutside, handleEscFunction])
  return { node, open, setOpen }
}

export default useCloseOnClickOrEsc

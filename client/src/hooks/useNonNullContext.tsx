import React, {useContext} from "react"

/**
 * Use the context, but assume that all properties of the context object are non-null.
 * This should only be used in situations where we're certain that all properties have been
 * initialized.
 */
function useNonNullContext<T>(context: React.Context<T>): Required<T> {
  return useContext(context) as Required<T>
}

export default useNonNullContext

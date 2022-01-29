import {DependencyList, useRef, useState, useEffect, useCallback} from "react"

// These hooks are based off https://github.com/streamich/react-use, but adapted
// to allow the async function to return `undefined` instead of a `Promise`. This is
// useful for when inputs to the async function are undefined.

// A hook that returns a function indicating whether the component is still mounted.
// Useful for checking mount state in async callbacks.
function useMountedState(): () => boolean {
  const mountedRef = useRef<boolean>(false)
  const get = useCallback(() => mountedRef.current, [])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  return get
}

export type RefreshFn = () => void

export type AsyncResult<T> =
  | {
      status: "idle"
    }
  | {
      status: "loading"
    }
  | {
      status: "succeeded"
      value: T
    }
  | {
      status: "errored"
      error: Error
    }

/**
 * A hook that runs the passed `fn` and returns a result. The result is updated as execution of the
 * async function continues.
 * @param fn - The async function to run. The function should return a `Promise` or `undefined`. If `undefined`,
 *  the `AsyncResult` state will remain `"idle"`.
 */
export function useAsync<T>(fn: () => Promise<T> | undefined, deps: DependencyList = []): AsyncResult<T> {
  let [result, call] = useAsyncFn<T>(fn, deps)
  useEffect(() => {
    call()
  }, [call])
  return result
}

/**
 * A hook that returns an `AsyncResult` and function for running the passed in `fn`. The result is
 * updated as execution of the async function continues. Unlike `useAsync`, the `fn` is not automatically run until
 * the returned function is called. This is useful for when the result needs to be periodically refreshed.
 *
 * @param fn - The async function to run. The function should return a `Promise` or `undefined`. If `undefined`,
 *  the `AsyncResult` state will remain `"idle"`.
 */
export function useAsyncFn<T>(
  fn: () => Promise<T> | undefined,
  deps: DependencyList = []
): [AsyncResult<T>, RefreshFn] {
  const lastCallId = useRef(0)
  const [state, setState] = useState<AsyncResult<T>>({status: "idle"})
  const isMounted = useMountedState()

  const callback = useCallback(() => {
    let promise = fn()

    if (promise) {
      const callId = ++lastCallId.current

      setState({status: "loading"})
      promise
        .then(
          (result: T) => isMounted() && callId === lastCallId.current && setState({status: "succeeded", value: result})
        )
        .catch((e) => {
          if (isMounted() && callId === lastCallId.current) {
            console.error("Error caught in `useAsyncFn`:", e)
            setState({status: "errored", error: e})
          } else {
            console.error("Obsolete error caught in `useAsyncFn`:", e)
          }
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, ...deps])

  return [state, callback]
}

/**
 * Returns state that is only updated when the `AsyncResult` has successfully produced a value.
 * In other words, the returned state will only be undefined while the AsyncResult is loading
 * for the first time. On subsequent loads, the returned state will keep its current value until
 * the new value is ready.
 *
 * This behavior is similar to the "stale-while-revalidate" cache-control.
 */
export function useStaleWhileRevalidating<T>(result: AsyncResult<T>): T | undefined {
  const [value, setValue] = useState<T>()

  useEffect(() => {
    if (result.status === "succeeded") {
      setValue(result.value)
    }
  }, [result])

  return value
}

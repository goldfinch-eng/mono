import React, { useState } from "react"
import { AppContext } from "../App"
import useGeolocation from "./useGeolocation"
import { renderHook } from "@testing-library/react-hooks"

describe("useGeolocation", () => {
  let store: any, wrapper: any

  beforeEach(() => {
    wrapper = ({ children }) => {
      let [geolocationData, setGeolocationData] = useState()
      store = {
        geolocationData,
        setGeolocationData,
      }
      return <AppContext.Provider value={store}>{children}</AppContext.Provider>
    }
  })

  it("fetches geolocation data and caches it in global state", async () => {
    const { result, waitFor } = renderHook(() => useGeolocation(), { wrapper })

    await waitFor(() => {
      expect(store.geolocationData).not.toBeUndefined()
      expect(result.current).toEqual(store.geolocationData)
    })
  })
})

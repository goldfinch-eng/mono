import React from "react"
import {AppContext} from "../App"
import BigNumber from "bignumber.js"
import useCurrencyUnlocked from "./useCurrencyUnlocked"
import {renderHook, act} from "@testing-library/react-hooks"

class FakeERC20 {
  allowance: any
  constructor(allowance) {
    this.allowance = allowance || new BigNumber(100)
  }

  async getAllowance(opts) {
    return this.allowance
  }
}

describe("useCurrencyUnlocked", () => {
  let store, wrapper, erc20
  let allowance = new BigNumber(100)
  let transactionLimit = new BigNumber(10)

  beforeEach(() => {
    store = {
      goldfinchConfig: {
        transactionLimit: transactionLimit,
      },
    }
    wrapper = ({children}) => <AppContext.Provider value={store}>{children}</AppContext.Provider>
    erc20 = new FakeERC20(allowance)
  })

  describe("minimum is lower than allowance", () => {
    it("is unlocked", async () => {
      const {result, waitFor} = renderHook(
        () =>
          useCurrencyUnlocked(erc20, {
            owner: "owner",
            spender: "spender",
            minimum: allowance.minus(1),
          }),
        {wrapper}
      )

      await waitFor(() => {
        const [unlocked] = result.current
        expect(unlocked).toBe(true)
      })
    })
  })

  describe("minimum >= allowance", () => {
    it("is not unlocked", async () => {
      const {result, waitForNextUpdate} = renderHook(
        () =>
          useCurrencyUnlocked(erc20, {
            owner: "owner",
            spender: "spender",
            minimum: allowance.plus(1),
          }),
        {wrapper}
      )

      await waitForNextUpdate()
      const [unlocked] = result.current
      expect(unlocked).toBe(false)
    })
  })

  describe("minimum is not provided", () => {
    it("uses GoldfinchConfig.transactionLimit", async () => {
      erc20.allowance = transactionLimit.minus(1)

      const {result, waitForNextUpdate} = renderHook(
        () =>
          // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '{ owner: string; spender: string... Remove this comment to see the full error message
          useCurrencyUnlocked(erc20, {
            owner: "owner",
            spender: "spender",
          }),
        {wrapper}
      )

      await waitForNextUpdate()
      const [unlocked] = result.current
      expect(unlocked).toBe(false)
    })
  })

  describe("refreshUnlocked", () => {
    it("updates unlocked", async () => {
      const {result, waitForNextUpdate} = renderHook(
        () =>
          useCurrencyUnlocked(erc20, {
            owner: "owner",
            spender: "spender",
            minimum: allowance.plus(1),
          }),
        {wrapper}
      )

      await waitForNextUpdate()
      let [unlocked, refreshUnlocked] = result.current
      expect(unlocked).toBe(false)

      // Simulate user approving for greater than minimum
      erc20.allowance = allowance.plus(2)
      // @ts-expect-error ts-migrate(2349) FIXME: This expression is not callable.
      await act(() => refreshUnlocked())
      ;[unlocked, refreshUnlocked] = result.current
      expect(unlocked).toBe(true)
    })
  })
})

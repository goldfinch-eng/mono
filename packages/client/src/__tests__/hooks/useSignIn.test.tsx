import {useSessionLocalStorage} from "../../hooks/useSignIn"
import {renderHook} from "@testing-library/react-hooks"

describe("useSessionLocalStorage hook", () => {
  it("should return the default value", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })

  it("should return the default value with data format invalid as null", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    Storage.prototype.getItem = jest.fn(() => null)

    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })

  it("should return the default value with data format invalid as undefined", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'Mock<undefined, []>' is not assignable to ty... Remove this comment to see the full error message
    Storage.prototype.getItem = jest.fn(() => undefined)

    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })

  it("should return the default value with data format invalid as empty string", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    Storage.prototype.getItem = jest.fn(() => "")

    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })

  it("should return the default value with data format invalid with extra params", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    Storage.prototype.getItem = jest.fn(
      () =>
        // eslint-disable-next-line
        '{"signature":"sig","signatureBlockNum":13,"signatureBlockNumTimestamp":1631996519,"version":1,"extra":"extra"}'
    )
    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })

  it("should return the default value with data format invalid with less params", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    // eslint-disable-next-line
    Storage.prototype.getItem = jest.fn(() => '{"signature":"sig","signatureBlockNum":13}')

    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })

  it("should return the default value, for expired credentials", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    Storage.prototype.getItem = jest.fn(
      () =>
        // eslint-disable-next-line
        '{"signature":"sig","signatureBlockNum":13,"signatureBlockNumTimestamp":1631996519,"version":1}'
    )

    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519 + 60 * 60 * 24 + 1))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })

  it("should return the value on local storage, for non-expired credentials", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem")
    Storage.prototype.getItem = jest.fn(
      // eslint-disable-next-line
      () => '{"signature":"sig","signatureBlockNum":13,"signatureBlockNumTimestamp":1631996519,"version":1}'
    )

    const {result} = renderHook(() => useSessionLocalStorage("sessionData", {}, 1631996519 + 60 * 60 * 24))
    expect(setItem).toHaveBeenCalled()

    const expectedResult = {signature: "sig", signatureBlockNum: 13, signatureBlockNumTimestamp: 1631996519, version: 1}
    expect(result.current.localStorageValue).toEqual(expectedResult)
  })
})

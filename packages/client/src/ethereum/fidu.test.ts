import BigNumber from "bignumber.js"
import {fiduFromAtomic, fiduToAtomic} from "./fidu"

describe("fiduFromAtomic", () => {
  describe("given a string", () => {
    it("returns the correct value", () => {
      const input = "1"
      const expected = "0.000000000000000001"
      const sampled = fiduFromAtomic(input)
      expect(expected).toEqual(sampled)
    })
  })

  describe("given a BigNumber", () => {
    it("returns the correct value", () => {
      const input = new BigNumber("1")
      const expected = "0.000000000000000001"
      const sampled = fiduFromAtomic(input)
      expect(sampled).toEqual(expected)
    })
  })
})

describe("fiduToAtomic", () => {
  describe("given a string", () => {
    it("returns the correct value", () => {
      const input = "1"
      const expected = "1000000000000000000"
      const sampled = fiduToAtomic(input)
      expect(sampled).toEqual(expected)
    })
  })

  describe("given a BigNumber", () => {
    it("returns the correct value", () => {
      const input = new BigNumber("1")
      const expected = "1000000000000000000"
      const sampled = fiduToAtomic(input)
      expect(sampled).toEqual(expected)
    })
  })
})

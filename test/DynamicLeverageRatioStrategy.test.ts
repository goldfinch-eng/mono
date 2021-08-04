/* global web3 */
import hre from "hardhat"
const {deployments, artifacts} = hre
const DynamicLeverageRatioStrategy = artifacts.require("DynamicLeverageRatioStrategy")

describe("DynamicLeverageRatioStrategy", () => {
  describe("initialize", () => {
    it("should give the owner the SETTER_ROLE role", () => {
      // TODO
      throw new Error()
    })
  })

  describe("getLeverageRatio", () => {
    it("should reject if the locked-until timestamp of the info in storage does not equal that of the junior tranche", () => {
      // TODO should be able to accomplish this by calling lockPool() after calling lockJuniorCapital()
      throw new Error()
    })
    it("should return the leverage ratio if the locked-until timestamp of the info in storage equals that of the junior tranche", () => {
      // TODO
      throw new Error()
    })
  })

  describe("setLeverageRatio", () => {
    it("should reject setting the leverage ratio to 0", () => {
      // TODO
      throw new Error()
    })
    it("should reject setting the leverage ratio with a locked-until timestamp of 0", () => {
      // TODO
      throw new Error()
    })
    it("should reject setting the leverage ratio with a locked-until timestamp that does not equal that of the junior tranche", () => {
      // TODO
      throw new Error()
    })
    it("should set the leverage ratio, for a locked-until timestamp that equals that of the junior tranche", () => {
      // TODO
      throw new Error()
    })
    it("should emit a LeverageRatioUpdated event", () => {
      // TODO
      throw new Error()
    })
    describe("onlySetterRole modifier", () => {
      it("should allow the owner, as the setter role, to set the leverage ratio", () => {
        // TODO
        throw new Error()
      })
      it("should allow a non-owner, as the setter role, to set the leverage ratio", () => {
        // TODO
        throw new Error()
      })
      it("should prohibit a non-owner who does not have the setter role from setting the leverage ratio", () => {
        // TODO
        throw new Error()
      })
    })
  })

  describe("estimateInvestment", () => {
    // TODO Reuse from FixedLeverageRatioStrategy
    throw new Error()
  })

  describe("invest", () => {
    // TODO Reuse from FixedLeverageRatioStrategy
    throw new Error()
  })
})

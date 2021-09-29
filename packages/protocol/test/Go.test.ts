/* global web3 */
import hre from "hardhat"
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  // TODO
})

describe("Go", () => {
  let owner: string

  beforeEach(async () => {
    // TODO
  })

  describe("initialize", () => {
    it("rejects zero address owner", async () => {
      // TODO
    })
    it("rejects zero address config", async () => {
      // TODO
    })
    it("rejects zero address goldfinchIdentity", async () => {
      // TODO
    })
    it("grants owner the owner and pauser roles", async () => {
      // TODO
    })
    it("does not grant deployer the owner and pauser roles", async () => {
      // TODO
    })
    it("sets config and goldfinchIdentity addresses in state", async () => {
      // TODO
    })
  })

  describe("updateGoldfinchConfig", () => {
    it("rejects sender who lacks owner role", async () => {
      // TODO
    })
    it("allows sender who has owner role", async () => {
      // TODO
    })
    it("updates config address, emits an event", async () => {
      // TODO
    })

    context("paused", () => {
      it("does not reject", async () => {
        // TODO
      })
    })
  })

  describe("go", () => {
    beforeEach(async () => {
      // TODO
    })

    it("rejects zero address account", async () => {
      // TODO
    })

    context("account with 0 balance GoldfinchIdentity token (id 0)", () => {
      context("account is on legacy go-list", () => {
        it("returns true", async () => {
          // TODO
        })
      })
      context("account is not on legacy go-list", () => {
        it("returns false", async () => {
          // TODO
        })
      })
    })

    context("account with > 0 balance GoldfinchIdentity token (id 0)", () => {
      context("account is on legacy go-list", () => {
        it("returns true", async () => {
          // TODO
        })
      })
      context("account is not on legacy go-list", () => {
        it("returns true", async () => {
          // TODO
        })
      })
    })

    context("paused", () => {
      it("returns anyway", async () => {
        // TODO
      })
    })
  })

  describe("upgradeability", () => {
    it("is upgradeable", async () => {
      // TODO
    })
  })
})

/* global web3 */
import BN from "bn.js"
import hre from "hardhat"
import {DepositMade} from "../typechain/truffle/SeniorPool"
import {
  bigVal,
  decodeLogs,
  deployAllContracts,
  erc20Approve,
  erc20Transfer,
  expect,
  getFirstLog,
  usdcVal,
} from "./testHelpers"
const {ethers} = hre
const {deployments} = hre

describe("CommunityRewards", () => {
  beforeEach(async () => {})

  describe("grant", () => {
    beforeEach(async () => {})

    it("rejects sender who lacks admin role", async () => {})

    it("rejects 0 grant amount", async () => {})

    it("allows 0 vesting length", async () => {})

    it("rejects a cliff length that exceeds vesting length", async () => {})

    it("rejects a vesting interval of 0", async () => {})

    it("rejects a vesting interval that is not a factor of vesting length", async () => {})

    it("rejects granting an amount that exceeds the available rewards", async () => {})

    it("updates state, mints an NFT owned by the grant recipient, and emits an event", async () => {})

    context("paused", async () => {
      it("reverts", async () => {})
    })

    context("reentrancy", async () => {
      it("reverts", async () => {})
    })
  })

  describe("loadRewards", async () => {
    it("rejects sender who lacks admin role", async () => {})

    it("rejects 0 amount", async () => {})

    it("transfers GFI from sender, updates state, and emits an event", async () => {})
  })

  describe("revokeGrant", async () => {
    it("rejects sender who lacks admin role", async () => {})

    it("rejects call for a non-existent token id", async () => {})

    it("rejects if grant has already been revoked", async () => {})

    it("rejects if grant has already fully vested", async () => {})

    it("updates state and emits an event", async () => {})

    context("paused", async () => {
      it("reverts", async () => {})
    })
  })

  describe("getReward", async () => {
    it("rejects sender who is not owner of the token", async () => {})

    it("allows call if claimable amount is 0", async () => {})

    it("updates state, transfers rewards, and emits an event, if claimable amount is > 0", async () => {})

    context("grant with 0 vesting length", async () => {
      it("gets full grant amount", async () => {})
    })

    context("grant with > 0 vesting length, 0 cliff", async () => {
      it("gets the vested amount", async () => {})
    })

    context("grant with vesting interval of 1", async () => {
      it("gets the vested amount", async () => {})
    })

    context("grant with vesting interval > 1", async () => {
      it("gets full grant amount", async () => {})
    })

    context("grant with vesting interval > 1", async () => {
      it("gets full grant amount", async () => {})
    })

    context("grant with > 0 cliff", async () => {
      it("gets 0 before cliff has elapsed", async () => {})

      it("gets vested amount after cliff has elapsed", async () => {})
    })

    context("revoked grant", async () => {
      it("after revocation, vested amount is still claimable", async () => {})

      it("after revocation, no further amount vests, so no further amount is claimable", async () => {})
    })

    context("paused", async () => {
      it("reverts", async () => {})
    })

    context("paused", async () => {
      it("reverts", async () => {})
    })

    context("reentrancy", async () => {
      it("reverts", async () => {})
    })
  })
})

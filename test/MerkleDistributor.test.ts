/* global web3 */
import hre from "hardhat"
const {ethers} = hre
const {deployments} = hre

describe("MerkleDistributor", () => {
  beforeEach(async () => {

  })

  describe("communityRewards", () => {
    it("returns the address of the CommunityRewards contract", () => {})
  })

  describe("merkleRoot", () => {
    it("returns the Merkle root", () => {})
  })

  describe("isGrantAccepted", () => {
    beforeEach(async () => {

    })

    it("returns true for a grant that has been accepted", async () => {})

    it("returns false for a grant that has not been accepted", async () => {})
  })

  describe("acceptGrant", async () => {
    it("rejects if the grant has already been accepted", async () => {})

    it("rejects a non-existent grant index", async () => {})

    it("rejects an existent grant index with incorrect account", async () => {})

    it("rejects an existent grant index with incorrect (lesser) amount", async () => {})

    it("rejects an existent grant index with incorrect (greater) amount", async () => {})

    it("rejects an existent grant index with incorrect vesting length", async () => {})

    it("rejects an existent grant index with incorrect cliff length", async () => {})

    it("rejects an existent grant index with incorrect vesting interval", async () => {})

    it("rejects an existent grant index with incorrect (empty) proof", async () => {})

    it("rejects an existent grant index with incorrect (non-empty) proof", async () => {})

    it("sets the grant as accepted, calls `CommunityRewards.grant()`, and emits an event", async () => {})

    it("is not aware of a, and therefore does not prevent a duplicate, grant with identical details that was not made by this contract", async () => {})

    it("uses the expected amount of gas", async () => {})
  })
})

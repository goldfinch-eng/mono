/* global web3 */
import hre from "hardhat"
import {GFIInstance} from "../typechain/truffle/GFI"
import {MerkleDistributorInstance} from "../typechain/truffle/MerkleDistributor"
import {TestCommunityRewardsInstance} from "../typechain/truffle/TestCommunityRewards"
import { assertNonNullable } from "../utils/type"
import {fixtures} from "./merkleDistributorHelpers"
import {deployAllContracts} from "./testHelpers"
const {ethers} = hre
const {deployments} = hre

describe("MerkleDistributor", () => {
  let owner: string,
    anotherUser: string,
    gfi: GFIInstance,
    communityRewards: TestCommunityRewardsInstance,
    merkleDistributor: MerkleDistributorInstance

  beforeEach(async () => {
    ;[owner, anotherUser] = await web3.eth.getAccounts()
    const deployed = await deployAllContracts(deployments, {
      deployMerkleDistributor: {fromAccount: owner, root: fixtures.output.merkleRoot},
    })
    gfi = deployed.gfi
    communityRewards = deployed.communityRewards
    assertNonNullable(deployed.merkleDistributor)
    merkleDistributor = deployed.merkleDistributor
  })

  describe("communityRewards", () => {
    it("returns the address of the CommunityRewards contract", async () => {
      const communityRewardsAddress = await merkleDistributor.communityRewards()
      expect(communityRewardsAddress).to.be.ok
      expect(communityRewardsAddress).to.equal(communityRewards.address)
    })
  })

  describe("merkleRoot", () => {
    it("returns the Merkle root", async () => {
      const merkleRoot = await merkleDistributor.merkleRoot()
      expect(merkleRoot).to.be.ok
      expect(merkleRoot).to.equal(fixtures.output.merkleRoot)
    })
  })

  describe("isGrantAccepted", () => {
    beforeEach(async () => {})

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

    it("sets the grant as accepted, calls `CommunityRewards.grant()`, and emits an event", async () => {
      // Note that the caller in this case is entirely unrelated to the grant recipient; anyone can call
      // `acceptGrant()` for any grant recipient.
    })

    it("is not aware of a, and therefore does not prevent a duplicate, grant with identical details that was not made by this contract", async () => {})

    it("uses the expected amount of gas", async () => {})
  })
})

/* global web3 */
import {BN} from "ethereumjs-tx/node_modules/ethereumjs-util"
import hre from "hardhat"
import {GFIInstance} from "../typechain/truffle/GFI"
import {GrantAccepted, MerkleDistributorInstance} from "../typechain/truffle/MerkleDistributor"
import {Granted, TestCommunityRewardsInstance} from "../typechain/truffle/TestCommunityRewards"
import {assertNonNullable} from "../utils/type"
import {mintAndLoadRewards} from "./communityRewardsHelpers"
import {fixtures} from "./merkleDistributorHelpers"
import {decodeLogs, deployAllContracts, getOnlyLog} from "./testHelpers"
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

  async function acceptGrant({
    from,
    index,
    account,
    amount,
    vestingLength,
    cliffLength,
    vestingInterval,
    proof,
  }: {
    from: string
    index: number
    account: string
    amount: BN
    vestingLength: BN
    cliffLength: BN
    vestingInterval: BN
    proof: string[]
  }): Promise<void> {
    const receipt = await merkleDistributor.acceptGrant(
      index,
      account,
      amount,
      vestingLength,
      cliffLength,
      vestingInterval,
      proof,
      {from}
    )

    // Verify the GrantAccepted event emitted by MerkleDistributor.
    const grantAcceptedEvent = getOnlyLog<GrantAccepted>(
      decodeLogs(receipt.receipt.rawLogs, merkleDistributor, "GrantAccepted")
    )
    expect(grantAcceptedEvent.args.index).to.bignumber.equal(new BN(index))
    expect(grantAcceptedEvent.args.account).to.equal(account)
    expect(grantAcceptedEvent.args.amount).to.bignumber.equal(amount)
    expect(grantAcceptedEvent.args.vestingLength).to.bignumber.equal(vestingLength)
    expect(grantAcceptedEvent.args.cliffLength).to.bignumber.equal(cliffLength)
    expect(grantAcceptedEvent.args.vestingInterval).to.bignumber.equal(vestingInterval)

    // Verify the Granted event emitted by CommunityRewards.
    const grantedEvent = getOnlyLog<Granted>(decodeLogs(receipt.receipt.rawLogs, communityRewards, "Granted"))
    const tokenId = grantedEvent.args.tokenId
    expect(grantedEvent.args.user).to.equal(account)
    expect(grantedEvent.args.amount).to.bignumber.equal(amount)
    expect(grantedEvent.args.vestingLength).to.bignumber.equal(vestingLength)
    expect(grantedEvent.args.cliffLength).to.bignumber.equal(cliffLength)
    expect(grantedEvent.args.vestingInterval).to.bignumber.equal(vestingInterval)

    // Verify that ownership of the NFT minted by CommunityRewards belongs to the
    // address to whom the grant belongs (e.g. as opposed to `from`).
    expect(await communityRewards.ownerOf(tokenId)).to.equal(account)
  }

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

    it("returns false for a grant that has not been accepted", async () => {
      const grantInfo = fixtures.output.grants[0]
      assertNonNullable(grantInfo)

      const index = grantInfo.index
      const isGrantAccepted = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false
    })

    it("returns true for a grant that has been accepted", async () => {
      const grantInfo = fixtures.output.grants[0]
      assertNonNullable(grantInfo)

      await mintAndLoadRewards(gfi, communityRewards, owner, web3.utils.toBN(grantInfo.grant.amount))

      const index = grantInfo.index
      const isGrantAccepted = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false

      await acceptGrant({
        from: anotherUser,
        index,
        account: grantInfo.account,
        amount: web3.utils.toBN(grantInfo.grant.amount),
        vestingLength: web3.utils.toBN(grantInfo.grant.vestingLength),
        cliffLength: web3.utils.toBN(grantInfo.grant.cliffLength),
        vestingInterval: web3.utils.toBN(grantInfo.grant.vestingInterval),
        proof: grantInfo.proof,
      })

      const isGrantAccepted2 = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted2).to.be.true
    })

    it("a grant's acceptance should not affect another grant", async () => {
      const grantInfo = fixtures.output.grants[1]
      assertNonNullable(grantInfo)

      const otherGrantInfo = fixtures.output.grants[2]
      assertNonNullable(otherGrantInfo)

      expect(grantInfo.account).to.equal(otherGrantInfo.account)

      await mintAndLoadRewards(
        gfi,
        communityRewards,
        owner,
        web3.utils.toBN(grantInfo.grant.amount).add(web3.utils.toBN(otherGrantInfo.grant.amount))
      )

      const index = grantInfo.index
      const isGrantAccepted = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false

      const otherIndex = otherGrantInfo.index
      const isOtherGrantAccepted = await merkleDistributor.isGrantAccepted(otherIndex)
      expect(isOtherGrantAccepted).to.be.false

      await acceptGrant({
        from: anotherUser,
        index: otherGrantInfo.index,
        account: otherGrantInfo.account,
        amount: web3.utils.toBN(otherGrantInfo.grant.amount),
        vestingLength: web3.utils.toBN(otherGrantInfo.grant.vestingLength),
        cliffLength: web3.utils.toBN(otherGrantInfo.grant.cliffLength),
        vestingInterval: web3.utils.toBN(otherGrantInfo.grant.vestingInterval),
        proof: otherGrantInfo.proof,
      })

      const isOtherGrantAccepted2 = await merkleDistributor.isGrantAccepted(otherIndex)
      expect(isOtherGrantAccepted2).to.be.true

      const isGrantAccepted2 = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted2).to.be.false
    })
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

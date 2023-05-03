/* global web3 */
import {BN} from "ethereumjs-util"
import hre, {getNamedAccounts} from "hardhat"
import {MerkleDistributorGrantInfo} from "../blockchain_scripts/merkle/merkleDistributor/types"
import {GFIInstance} from "../typechain/truffle/contracts/protocol/core/GFI"
import {GrantAccepted, MerkleDistributorInstance} from "../typechain/truffle/contracts/rewards/MerkleDistributor"
import {Granted, CommunityRewardsInstance} from "../typechain/truffle/contracts/rewards/CommunityRewards"
import {asNonNullable, assertNonEmptyArray, assertNonNullable} from "@goldfinch-eng/utils"
import {mintAndLoadRewards} from "./communityRewardsHelpers"
import {fixtures} from "./merkleDistributorHelpers"
import {decodeLogs, fundWithEthFromLocalWhale, genDifferentHexString, getOnlyLog} from "./testHelpers"
import {deployBaseFixture} from "./util/fixtures"
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  const amount = new BN("1")
  const {test_merkle_distributor_recipient_a, test_merkle_distributor_recipient_b} = await getNamedAccounts()
  assertNonNullable(test_merkle_distributor_recipient_a)
  assertNonNullable(test_merkle_distributor_recipient_b)
  const [_owner] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)

  const deployed = await deployBaseFixture({
    deployMerkleDistributor: {fromAccount: owner, root: fixtures.output.merkleRoot},
  })

  await fundWithEthFromLocalWhale(test_merkle_distributor_recipient_a, amount)
  await fundWithEthFromLocalWhale(test_merkle_distributor_recipient_b, amount)

  const gfi = deployed.gfi
  const communityRewards = deployed.communityRewards
  assertNonNullable(deployed.merkleDistributor)
  const merkleDistributor = deployed.merkleDistributor

  return {owner, gfi, communityRewards, merkleDistributor}
})

describe("MerkleDistributor", () => {
  let owner: string,
    gfi: GFIInstance,
    communityRewards: CommunityRewardsInstance,
    merkleDistributor: MerkleDistributorInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({owner, gfi, communityRewards, merkleDistributor} = await setupTest())
  })

  async function acceptGrant({
    from,
    index,
    amount,
    vestingLength,
    cliffLength,
    vestingInterval,
    proof,
  }: {
    from: string
    index: number
    amount: BN
    vestingLength: BN
    cliffLength: BN
    vestingInterval: BN
    proof: string[]
  }): Promise<BN> {
    const rewardsAvailableBefore = await communityRewards.rewardsAvailable()

    const receipt = await merkleDistributor.acceptGrant(
      index,
      amount,
      vestingLength,
      cliffLength,
      vestingInterval,
      proof,
      {from}
    )

    const rewardsAvailableAfter = await communityRewards.rewardsAvailable()

    // CommunityRewards's behavior

    // Verify the Granted event emitted by CommunityRewards.
    const grantedEvent = getOnlyLog<Granted>(decodeLogs(receipt.receipt.rawLogs, communityRewards, "Granted"))
    const tokenId = grantedEvent.args.tokenId
    expect(grantedEvent.args.user).to.equal(from)
    expect(grantedEvent.args.amount).to.bignumber.equal(amount)
    expect(grantedEvent.args.vestingLength).to.bignumber.equal(vestingLength)
    expect(grantedEvent.args.cliffLength).to.bignumber.equal(cliffLength)
    expect(grantedEvent.args.vestingInterval).to.bignumber.equal(vestingInterval)

    // Verify that ownership of the NFT minted by CommunityRewards belongs to the accepter.
    expect(await communityRewards.ownerOf(tokenId)).to.equal(from)

    // Verify that rewards available has been decremented reflecting the amount of the grant.
    expect(rewardsAvailableBefore.sub(rewardsAvailableAfter)).to.bignumber.equal(amount)

    // MerkleDistributor's behavior

    // Verify that the grant is now considered accepted.
    const isGrantAccepted = await merkleDistributor.isGrantAccepted(index)
    expect(isGrantAccepted).to.be.true

    // Verify the GrantAccepted event emitted by MerkleDistributor.
    const grantAcceptedEvent = getOnlyLog<GrantAccepted>(
      decodeLogs(receipt.receipt.rawLogs, merkleDistributor, "GrantAccepted")
    )
    expect(grantAcceptedEvent.args.tokenId).to.bignumber.equal(tokenId)
    expect(grantAcceptedEvent.args.index).to.bignumber.equal(new BN(index))
    expect(grantAcceptedEvent.args.account).to.equal(from)
    expect(grantAcceptedEvent.args.amount).to.bignumber.equal(amount)
    expect(grantAcceptedEvent.args.vestingLength).to.bignumber.equal(vestingLength)
    expect(grantAcceptedEvent.args.cliffLength).to.bignumber.equal(cliffLength)
    expect(grantAcceptedEvent.args.vestingInterval).to.bignumber.equal(vestingInterval)

    return new BN(tokenId)
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
    let grantInfo: MerkleDistributorGrantInfo
    let index: number
    let acceptGrantParams: Parameters<typeof acceptGrant>[0]

    beforeEach(async () => {
      const _grantInfo = fixtures.output.grants[0]
      assertNonNullable(_grantInfo)
      grantInfo = _grantInfo
      index = grantInfo.index
      acceptGrantParams = {
        from: grantInfo.account,
        index,
        amount: web3.utils.toBN(grantInfo.grant.amount),
        vestingLength: web3.utils.toBN(grantInfo.grant.vestingLength),
        cliffLength: web3.utils.toBN(grantInfo.grant.cliffLength),
        vestingInterval: web3.utils.toBN(grantInfo.grant.vestingInterval),
        proof: grantInfo.proof,
      }

      await mintAndLoadRewards(gfi, communityRewards, owner, web3.utils.toBN(grantInfo.grant.amount))
    })

    it("returns false for a grant that has not been accepted", async () => {
      const isGrantAccepted = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false
    })

    it("returns true for a grant that has been accepted", async () => {
      const isGrantAccepted = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false

      await acceptGrant(acceptGrantParams)

      const isGrantAccepted2 = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted2).to.be.true
    })

    it("a grant's acceptance should not affect another grant", async () => {
      const grantInfo1 = fixtures.output.grants[1]
      assertNonNullable(grantInfo1)

      const grantInfo2 = fixtures.output.grants[2]
      assertNonNullable(grantInfo2)

      expect(grantInfo1.account).to.equal(grantInfo2.account)

      await mintAndLoadRewards(
        gfi,
        communityRewards,
        owner,
        web3.utils.toBN(grantInfo1.grant.amount).add(web3.utils.toBN(grantInfo2.grant.amount))
      )

      const index1 = grantInfo1.index
      const isGrant1Accepted = await merkleDistributor.isGrantAccepted(index1)
      expect(isGrant1Accepted).to.be.false

      const index2 = grantInfo2.index
      const isGrant2Accepted = await merkleDistributor.isGrantAccepted(index2)
      expect(isGrant2Accepted).to.be.false

      await acceptGrant({
        from: grantInfo2.account,
        index: grantInfo2.index,
        amount: web3.utils.toBN(grantInfo2.grant.amount),
        vestingLength: web3.utils.toBN(grantInfo2.grant.vestingLength),
        cliffLength: web3.utils.toBN(grantInfo2.grant.cliffLength),
        vestingInterval: web3.utils.toBN(grantInfo2.grant.vestingInterval),
        proof: grantInfo2.proof,
      })

      const isGrant2Accepted2 = await merkleDistributor.isGrantAccepted(index2)
      expect(isGrant2Accepted2).to.be.true

      const isGrant1Accepted2 = await merkleDistributor.isGrantAccepted(index1)
      expect(isGrant1Accepted2).to.be.false
    })
  })

  describe("acceptGrant", async () => {
    let grantInfo: MerkleDistributorGrantInfo
    let index: number
    let acceptGrantParams: Parameters<typeof acceptGrant>[0]

    beforeEach(async () => {
      const _grantInfo = fixtures.output.grants[0]
      assertNonNullable(_grantInfo)
      grantInfo = _grantInfo
      index = grantInfo.index
      acceptGrantParams = {
        from: grantInfo.account,
        index,
        amount: web3.utils.toBN(grantInfo.grant.amount),
        vestingLength: web3.utils.toBN(grantInfo.grant.vestingLength),
        cliffLength: web3.utils.toBN(grantInfo.grant.cliffLength),
        vestingInterval: web3.utils.toBN(grantInfo.grant.vestingInterval),
        proof: grantInfo.proof,
      }

      await mintAndLoadRewards(gfi, communityRewards, owner, web3.utils.toBN(grantInfo.grant.amount))
    })

    it("rejects sender who is not the recipient of the grant", async () => {
      const otherGrantInfo = fixtures.output.grants[1]
      assertNonNullable(otherGrantInfo)
      expect(otherGrantInfo.account).not.to.equal(acceptGrantParams.from)
      const nonRecipient = otherGrantInfo.account
      await expect(
        acceptGrant({
          ...acceptGrantParams,
          from: nonRecipient,
        })
      ).to.be.rejectedWith(/Invalid proof/)
    })

    it("allows sender who is the recipient of the grant", async () => {
      await expect(acceptGrant(acceptGrantParams)).to.be.fulfilled
    })

    it("rejects if the grant has already been accepted", async () => {
      const isGrantAccepted = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false

      await acceptGrant(acceptGrantParams)

      const isGrantAccepted2 = await merkleDistributor.isGrantAccepted(index)
      expect(isGrantAccepted2).to.be.true

      await expect(acceptGrant(acceptGrantParams)).to.be.rejectedWith(/Grant already accepted/)
    })

    it("rejects a non-existent grant index", async () => {
      const invalidIndex = fixtures.output.grants.length
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        index: invalidIndex,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect (lesser) amount", async () => {
      const invalidLesserAmount = acceptGrantParams.amount.sub(new BN(1))
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        amount: invalidLesserAmount,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect (greater) amount", async () => {
      const invalidGreaterAmount = acceptGrantParams.amount.add(new BN(1))
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        amount: invalidGreaterAmount,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect vesting length", async () => {
      const invalidVestingLength = acceptGrantParams.vestingLength.add(new BN(1))
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        vestingLength: invalidVestingLength,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect cliff length", async () => {
      const invalidCliffLength = acceptGrantParams.cliffLength.add(new BN(1))
      expect(invalidCliffLength).to.bignumber.lt(acceptGrantParams.vestingLength)
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        cliffLength: invalidCliffLength,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect vesting interval", async () => {
      const invalidVestingInterval = acceptGrantParams.vestingInterval.mul(new BN(2))
      expect(invalidVestingInterval).to.bignumber.gt(new BN(0))
      expect(acceptGrantParams.vestingLength.mod(invalidVestingInterval)).to.bignumber.equal(new BN(0))
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        vestingInterval: invalidVestingInterval,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect (empty) proof array", async () => {
      const invalidProof: string[] = []
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        proof: invalidProof,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect (empty) proof string", async () => {
      const invalidProof: string[] = grantInfo.proof.slice()
      assertNonEmptyArray(invalidProof)
      invalidProof[invalidProof.length - 1] = web3.utils.asciiToHex("")
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        proof: invalidProof,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("rejects an existent grant index with incorrect (non-empty) proof", async () => {
      const invalidProof: string[] = grantInfo.proof.slice()
      const lastElement = invalidProof[invalidProof.length - 1]
      assertNonNullable(lastElement)
      invalidProof[invalidProof.length - 1] = genDifferentHexString(lastElement)
      const acceptance = acceptGrant({
        ...acceptGrantParams,
        proof: invalidProof,
      })
      await expect(acceptance).to.be.rejectedWith(/Invalid proof/)
    })

    it("sets the grant as accepted, calls `CommunityRewards.grant()`, and emits an event", async () => {
      const acceptance = acceptGrant(acceptGrantParams)
      await expect(acceptance).to.be.fulfilled
    })

    it('is not aware of a, and therefore does not prevent a "duplicate", grant with identical details that was issued directly (i.e. not by this contract)', async () => {
      await mintAndLoadRewards(gfi, communityRewards, owner, web3.utils.toBN(grantInfo.grant.amount))

      const directIssuance = communityRewards.grant(
        acceptGrantParams.from,
        acceptGrantParams.amount,
        acceptGrantParams.vestingLength,
        acceptGrantParams.cliffLength,
        acceptGrantParams.vestingInterval,
        {from: owner}
      )
      await expect(directIssuance).to.be.fulfilled

      const acceptance = acceptGrant(acceptGrantParams)
      await expect(acceptance).to.be.fulfilled
    })

    it("uses the expected amount of gas", async () => {
      const receipt = await merkleDistributor.acceptGrant(
        acceptGrantParams.index,
        acceptGrantParams.amount,
        acceptGrantParams.vestingLength,
        acceptGrantParams.cliffLength,
        acceptGrantParams.vestingInterval,
        acceptGrantParams.proof,
        {from: acceptGrantParams.from}
      )
      expect(receipt.receipt.gasUsed).to.be.lte(367853)
    })
  })
})

/* global web3 */
import {BN} from "ethereumjs-util"
import hre, {getNamedAccounts} from "hardhat"
import {constants as ethersConstants} from "ethers"
import {MerkleDirectDistributorGrantInfo} from "../blockchain_scripts/merkle/merkleDirectDistributor/types"
import {GFIInstance} from "../typechain/truffle/contracts/protocol/core/GFI"
import {
  GrantAccepted,
  MerkleDirectDistributorInstance,
} from "../typechain/truffle/contracts/rewards/MerkleDirectDistributor"
import {asNonNullable, assertNonEmptyArray, assertNonNullable} from "@goldfinch-eng/utils"
import {fixtures} from "./merkleDirectDistributorHelpers"
import {
  decodeLogs,
  fundWithEthFromLocalWhale,
  genDifferentHexString,
  getOnlyLog,
  getTruffleContractAtAddress,
} from "./testHelpers"
import {deployBaseFixture} from "./util/fixtures"
import {getDeployedContract, OWNER_ROLE, PAUSER_ROLE} from "../blockchain_scripts/deployHelpers"
const {deployments} = hre

const setupTest = deployments.createFixture(async ({deployments}) => {
  const {deploy} = deployments
  const amount = new BN("1")
  const {test_merkle_direct_distributor_recipient_a, test_merkle_direct_distributor_recipient_b} =
    await getNamedAccounts()
  assertNonNullable(test_merkle_direct_distributor_recipient_a)
  assertNonNullable(test_merkle_direct_distributor_recipient_b)
  const [_owner, _anotherUser] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const uninitializedMerkleDirectDistributorDeployer = asNonNullable(_anotherUser)

  const deployed = await deployBaseFixture({
    deployMerkleDirectDistributor: {
      fromAccount: owner,
      root: fixtures.output.merkleRoot,
    },
  })

  await fundWithEthFromLocalWhale(test_merkle_direct_distributor_recipient_a, amount)
  await fundWithEthFromLocalWhale(test_merkle_direct_distributor_recipient_b, amount)

  const gfi = deployed.gfi
  assertNonNullable(deployed.merkleDirectDistributor)
  const merkleDirectDistributor = deployed.merkleDirectDistributor

  const uninitializedMerkleDirectDistributorDeployResult = await deploy("MerkleDirectDistributor", {
    from: owner,
    gasLimit: 4000000,
  })
  const uninitializedMerkleDirectDistributor = await getTruffleContractAtAddress<MerkleDirectDistributorInstance>(
    "MerkleDirectDistributor",
    uninitializedMerkleDirectDistributorDeployResult.address
  )

  return {
    owner,
    uninitializedMerkleDirectDistributorDeployer,
    gfi,
    merkleDirectDistributor,
    uninitializedMerkleDirectDistributor,
  }
})

describe("MerkleDirectDistributor", () => {
  let owner: string,
    uninitializedMerkleDirectDistributorDeployer: string,
    gfi: GFIInstance,
    merkleDirectDistributor: MerkleDirectDistributorInstance,
    uninitializedMerkleDirectDistributor: MerkleDirectDistributorInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      uninitializedMerkleDirectDistributorDeployer,
      gfi,
      merkleDirectDistributor,
      uninitializedMerkleDirectDistributor,
    } = await setupTest())
  })

  async function acceptGrant({
    from,
    index,
    amount,
    proof,
  }: {
    from: string
    index: number
    amount: BN
    proof: string[]
  }): Promise<void> {
    const rewardsAvailableBefore = await gfi.balanceOf(merkleDirectDistributor.address)
    const accepterBalancerBefore = await gfi.balanceOf(from)

    const receipt = await merkleDirectDistributor.acceptGrant(index, amount, proof, {from})

    const rewardsAvailableAfter = await gfi.balanceOf(merkleDirectDistributor.address)
    const accepterBalanceAfter = await gfi.balanceOf(from)

    // MerkleDirectDistributor's behavior

    // Verify that the grant is now considered accepted.
    const isGrantAccepted = await merkleDirectDistributor.isGrantAccepted(index)
    expect(isGrantAccepted).to.be.true

    // Verify the GrantAccepted event emitted by MerkleDirectDistributor.
    const grantAcceptedEvent = getOnlyLog<GrantAccepted>(
      decodeLogs(receipt.receipt.rawLogs, merkleDirectDistributor, "GrantAccepted")
    )
    expect(grantAcceptedEvent.args.index).to.bignumber.equal(new BN(index))
    expect(grantAcceptedEvent.args.account).to.equal(from)
    expect(grantAcceptedEvent.args.amount).to.bignumber.equal(amount)

    // Verify that the accepter has received their GFI rewards.
    expect(accepterBalanceAfter.sub(accepterBalancerBefore)).to.bignumber.equal(amount)

    // Verify that rewards available has been decremented reflecting the amount of the grant.
    expect(rewardsAvailableBefore.sub(rewardsAvailableAfter)).to.bignumber.equal(amount)
  }

  describe("deployment", () => {
    it("should respect the `owner` option specified for the proxy contract", async () => {
      const {protocol_owner} = await getNamedAccounts()
      assertNonNullable(protocol_owner)
      const proxy = await getDeployedContract(deployments, "MerkleDirectDistributor_Proxy", protocol_owner)

      const owner = await proxy.owner()
      expect(owner).to.equal(protocol_owner)
    })
  })

  describe("gfi", () => {
    it("returns the address of the GFI contract", async () => {
      const gfiAddress = await merkleDirectDistributor.gfi()
      expect(gfiAddress).to.be.ok
      expect(gfiAddress).to.equal(gfi.address)
    })
  })

  describe("merkleRoot", () => {
    it("returns the Merkle root", async () => {
      const merkleRoot = await merkleDirectDistributor.merkleRoot()
      expect(merkleRoot).to.be.ok
      expect(merkleRoot).to.equal(fixtures.output.merkleRoot)
    })
  })

  describe("initialize", () => {
    const fakeMerkleRoot = web3.utils.keccak256("FOO")

    it("rejects zero address owner", async () => {
      const initialized = uninitializedMerkleDirectDistributor.initialize(
        ethersConstants.AddressZero,
        gfi.address,
        fakeMerkleRoot
      )
      await expect(initialized).to.be.rejectedWith(/Owner address cannot be empty/)
    })
    it("rejects zero address for GFI contract", async () => {
      const initialized = uninitializedMerkleDirectDistributor.initialize(
        owner,
        ethersConstants.AddressZero,
        fakeMerkleRoot
      )
      await expect(initialized).to.be.rejectedWith(/GFI address cannot be empty/)
    })
    it("rejects zero value for Merkle root", async () => {
      const initialized = uninitializedMerkleDirectDistributor.initialize(owner, gfi.address, ethersConstants.HashZero)
      await expect(initialized).to.be.rejectedWith(/Invalid Merkle root/)
    })
    it("grants owner the owner and pauser roles", async () => {
      await uninitializedMerkleDirectDistributor.initialize(owner, gfi.address, fakeMerkleRoot, {
        from: uninitializedMerkleDirectDistributorDeployer,
      })
      expect(await uninitializedMerkleDirectDistributor.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await uninitializedMerkleDirectDistributor.hasRole(PAUSER_ROLE, owner)).to.equal(true)

      expect(await merkleDirectDistributor.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await merkleDirectDistributor.hasRole(PAUSER_ROLE, owner)).to.equal(true)
    })
    it("does not grant deployer the owner and pauser roles", async () => {
      await uninitializedMerkleDirectDistributor.initialize(owner, gfi.address, fakeMerkleRoot, {
        from: uninitializedMerkleDirectDistributorDeployer,
      })
      expect(
        await uninitializedMerkleDirectDistributor.hasRole(OWNER_ROLE, uninitializedMerkleDirectDistributorDeployer)
      ).to.equal(false)
      expect(
        await uninitializedMerkleDirectDistributor.hasRole(PAUSER_ROLE, uninitializedMerkleDirectDistributorDeployer)
      ).to.equal(false)
    })
    it("sets GFI address and Merkle root in state", async () => {
      expect(await uninitializedMerkleDirectDistributor.gfi()).to.equal(ethersConstants.AddressZero)
      expect(await uninitializedMerkleDirectDistributor.merkleRoot()).to.equal(ethersConstants.HashZero)
      await uninitializedMerkleDirectDistributor.initialize(owner, gfi.address, fakeMerkleRoot, {
        from: uninitializedMerkleDirectDistributorDeployer,
      })
      expect(await uninitializedMerkleDirectDistributor.gfi()).to.equal(gfi.address)
      expect(await uninitializedMerkleDirectDistributor.merkleRoot()).to.equal(fakeMerkleRoot)
    })
    it("cannot be called twice", async () => {
      await uninitializedMerkleDirectDistributor.initialize(owner, gfi.address, fakeMerkleRoot, {
        from: uninitializedMerkleDirectDistributorDeployer,
      })
      await expect(
        uninitializedMerkleDirectDistributor.initialize(owner, gfi.address, fakeMerkleRoot, {
          from: uninitializedMerkleDirectDistributorDeployer,
        })
      ).to.be.rejectedWith(/Contract instance has already been initialized/)
    })
  })

  describe("isGrantAccepted", () => {
    let grantInfo: MerkleDirectDistributorGrantInfo
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
        proof: grantInfo.proof,
      }

      await gfi.mint(merkleDirectDistributor.address, web3.utils.toBN(grantInfo.grant.amount))
    })

    it("returns false for a grant that has not been accepted", async () => {
      const isGrantAccepted = await merkleDirectDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false
    })

    it("returns true for a grant that has been accepted", async () => {
      const isGrantAccepted = await merkleDirectDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false

      await acceptGrant(acceptGrantParams)

      const isGrantAccepted2 = await merkleDirectDistributor.isGrantAccepted(index)
      expect(isGrantAccepted2).to.be.true
    })

    it("a grant's acceptance should not affect another grant", async () => {
      const grantInfo1 = fixtures.output.grants[1]
      assertNonNullable(grantInfo1)

      const grantInfo2 = fixtures.output.grants[2]
      assertNonNullable(grantInfo2)

      expect(grantInfo1.account).to.equal(grantInfo2.account)

      await gfi.mint(
        merkleDirectDistributor.address,
        web3.utils.toBN(grantInfo1.grant.amount).add(web3.utils.toBN(grantInfo2.grant.amount))
      )

      const index1 = grantInfo1.index
      const isGrant1Accepted = await merkleDirectDistributor.isGrantAccepted(index1)
      expect(isGrant1Accepted).to.be.false

      const index2 = grantInfo2.index
      const isGrant2Accepted = await merkleDirectDistributor.isGrantAccepted(index2)
      expect(isGrant2Accepted).to.be.false

      await acceptGrant({
        from: grantInfo2.account,
        index: grantInfo2.index,
        amount: web3.utils.toBN(grantInfo2.grant.amount),
        proof: grantInfo2.proof,
      })

      const isGrant2Accepted2 = await merkleDirectDistributor.isGrantAccepted(index2)
      expect(isGrant2Accepted2).to.be.true

      const isGrant1Accepted2 = await merkleDirectDistributor.isGrantAccepted(index1)
      expect(isGrant1Accepted2).to.be.false
    })
  })

  describe("acceptGrant", async () => {
    let grantInfo: MerkleDirectDistributorGrantInfo
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
        proof: grantInfo.proof,
      }

      await gfi.mint(merkleDirectDistributor.address, web3.utils.toBN(grantInfo.grant.amount))
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
      const isGrantAccepted = await merkleDirectDistributor.isGrantAccepted(index)
      expect(isGrantAccepted).to.be.false

      await acceptGrant(acceptGrantParams)

      const isGrantAccepted2 = await merkleDirectDistributor.isGrantAccepted(index)
      expect(isGrantAccepted2).to.be.true

      await expect(acceptGrant(acceptGrantParams)).to.be.rejectedWith(/Grant already accepted/)
    })

    it("rejection does not perform granting", async () => {
      // This test is arguably an unnecessary sanity check, because it should be impossible for
      // a reverted transaction on the EVM to be state-changing.

      await gfi.mint(merkleDirectDistributor.address, new BN(1e3))

      await acceptGrant(acceptGrantParams)

      const rewardsAvailableBefore = await gfi.balanceOf(merkleDirectDistributor.address)
      expect(rewardsAvailableBefore).to.bignumber.equal(new BN(1e3))

      await expect(acceptGrant(acceptGrantParams)).to.be.rejectedWith(/Grant already accepted/)

      // Check that rewards available was not decremented as part of the rejection.
      const rewardsAvailableAfter = await gfi.balanceOf(merkleDirectDistributor.address)
      expect(rewardsAvailableAfter).to.bignumber.equal(rewardsAvailableBefore)
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

    it("sets the grant as accepted, transfers GFI, and emits an event", async () => {
      const acceptance = acceptGrant(acceptGrantParams)
      await expect(acceptance).to.be.fulfilled
    })

    it("uses the expected amount of gas", async () => {
      const receipt = await merkleDirectDistributor.acceptGrant(
        acceptGrantParams.index,
        acceptGrantParams.amount,
        acceptGrantParams.proof,
        {from: acceptGrantParams.from}
      )
      expect(receipt.receipt.gasUsed).to.eq(90394)
    })

    context("paused", async () => {
      it("reverts", async () => {
        expect(await merkleDirectDistributor.paused()).to.equal(false)
        await merkleDirectDistributor.pause()
        expect(await merkleDirectDistributor.paused()).to.equal(true)
        const acceptance = acceptGrant(acceptGrantParams)
        await expect(acceptance).to.be.rejectedWith(/paused/)
      })
    })
  })
})

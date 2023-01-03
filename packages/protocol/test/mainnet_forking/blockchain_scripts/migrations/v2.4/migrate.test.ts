import {promises as fs} from "fs"
import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {
  DISTRIBUTOR_ROLE,
  getProtocolOwner,
  getTruffleContract,
  ZERO_ADDRESS,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate2_4 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.4/migrate"
import {
  advanceTime,
  bigVal,
  decodeLogs,
  expectOwnerRole,
  expectProxyOwner,
  expectRoles,
  getDeployedAsTruffleContract,
  getOnlyLog,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {isMerkleDistributorInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {isMerkleDirectDistributorInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import BN from "bn.js"
import {
  BackerMerkleDirectDistributorInstance,
  BackerMerkleDistributorInstance,
  CommunityRewardsInstance,
  GFIInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {Granted} from "@goldfinch-eng/protocol/typechain/truffle/contracts/rewards/CommunityRewards"
import _ from "lodash"
import {TOKEN_LAUNCH_TIME_IN_SECONDS} from "@goldfinch-eng/protocol/blockchain_scripts/baseDeploy"
import {assertCommunityRewardsVestingRewards} from "@goldfinch-eng/protocol/test/communityRewardsHelpers"
import {time} from "@openzeppelin/test-helpers"

const THREE_YEARS_IN_SECONDS = 365 * 24 * 60 * 60 * 3
const TOKEN_LAUNCH_TIME = new BN(TOKEN_LAUNCH_TIME_IN_SECONDS).add(new BN(THREE_YEARS_IN_SECONDS))

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("baseDeploy", {keepExistingDeployments: true})

  const gfi = await getTruffleContract<GFIInstance>("GFI")
  const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards")
  const communityRewardsStartingBalance = await communityRewards.rewardsAvailable()

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  const grantAddress1StartingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress1)
  const grantAddress2StartingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress2)

  await migrate2_4.main()

  return {
    gfi,
    communityRewards,
    communityRewardsStartingBalance,
    grantAddress1StartingBalance,
    grantAddress2StartingBalance,
  }
})

xdescribe("v2.4", async function () {
  this.timeout(TEST_TIMEOUT)

  let gfi: GFIInstance
  let communityRewards: CommunityRewardsInstance
  let communityRewardsStartingBalance: BN

  let grantAddress1StartingBalance: BN
  let grantAddress2StartingBalance: BN

  let merkleDirectDistributor: BackerMerkleDirectDistributorInstance
  let merkleDistributor: BackerMerkleDistributorInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      gfi,
      communityRewards,
      communityRewardsStartingBalance,
      grantAddress1StartingBalance,
      grantAddress2StartingBalance,
    } = await setupTest())
  })

  it("deploys BackerMerkleDirectDistributor", async () => {
    await expect(deployments.get("BackerMerkleDirectDistributor")).to.not.be.rejected
    merkleDirectDistributor = await getDeployedAsTruffleContract<BackerMerkleDirectDistributorInstance>(
      deployments,
      "BackerMerkleDirectDistributor"
    )
  })

  it("initializes BackerMerkleDirectDistributor", async () => {
    await expect(
      (
        await getTruffleContract<BackerMerkleDirectDistributorInstance>("BackerMerkleDirectDistributor")
      ).initialize(ZERO_ADDRESS, ZERO_ADDRESS, web3.utils.keccak256("test"), {from: await getProtocolOwner()})
    ).to.be.rejectedWith(/initialized/)
  })

  it("deploys BackerMerkleDistributor", async () => {
    await expect(deployments.get("BackerMerkleDistributor")).to.not.be.rejected
    merkleDistributor = await getDeployedAsTruffleContract<BackerMerkleDistributorInstance>(
      deployments,
      "BackerMerkleDistributor"
    )
  })

  expectProxyOwner({
    toBe: getProtocolOwner,
    forContracts: ["BackerMerkleDirectDistributor"],
  })

  expectOwnerRole({
    toBe: getProtocolOwner,
    forContracts: ["BackerMerkleDirectDistributor"],
  })

  expectRoles([
    {
      contractName: "CommunityRewards",
      roles: [DISTRIBUTOR_ROLE],
      address: async () => (await deployments.get("BackerMerkleDistributor")).address,
    },
  ])

  it("loads GFI into CommunityRewards using merkleDistributorInfo amount", async () => {
    const merkleDistributorInfo = JSON.parse(String(await fs.readFile(migrate2_4.merkleDistributorInfoPath)))
    if (!isMerkleDistributorInfo(merkleDistributorInfo)) {
      throw new Error("Invalid merkle distributor info")
    }
    const merkleDistributorAmount = web3.utils.toBN(merkleDistributorInfo.amountTotal)

    const rewardsAvailable = await communityRewards.rewardsAvailable()

    expect(rewardsAvailable.sub(communityRewardsStartingBalance)).to.bignumber.eq(merkleDistributorAmount)
  })

  it("loads GFI into BackerMerkleDirectDistributor using merkleDirectDistributorInfo amount", async () => {
    const merkleDirectDistributorInfo = JSON.parse(
      String(await fs.readFile(migrate2_4.merkleDirectDistributorInfoPath))
    )
    if (!isMerkleDirectDistributorInfo(merkleDirectDistributorInfo)) {
      throw new Error("Invalid merkle direct distributor info")
    }
    const merkleDirectDistributorAmount = web3.utils.toBN(merkleDirectDistributorInfo.amountTotal)

    const directDistributor = await deployments.get("BackerMerkleDirectDistributor")

    expect(await gfi.balanceOf(directDistributor.address)).to.bignumber.eq(merkleDirectDistributorAmount)
  })

  it("distributes GFI grant to the two community contributors", async () => {
    const grantAddress1EndingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress1)
    const grantAddress2EndingBalance: BN = await gfi.balanceOf(migrate2_4.grantAddress2)

    expect(grantAddress1EndingBalance.sub(grantAddress1StartingBalance)).to.bignumber.eq(bigVal(275))
    expect(grantAddress2EndingBalance.sub(grantAddress2StartingBalance)).to.bignumber.eq(bigVal(275))
  })

  it("allows to claim no-vesting rewards immediately", async () => {
    const noVestingGrantsJson = JSON.parse(String(await fs.readFile(migrate2_4.merkleDirectDistributorInfoPath)))
    if (!isMerkleDirectDistributorInfo(noVestingGrantsJson)) {
      throw new Error("Invalid merkle distributor info")
    }

    const sampledGrants = _.sampleSize(noVestingGrantsJson.grants, 50)
    for (const grant of sampledGrants) {
      const {
        index,
        proof,
        account: recipient,
        grant: {amount},
      } = grant

      const recipientBalanceBefore = await gfi.balanceOf(recipient)

      await impersonateAccount(hre, recipient)
      await fundWithWhales(["ETH"], [recipient])

      await merkleDirectDistributor.acceptGrant(index, amount, proof, {from: recipient})

      const recipientBalanceAfter = await gfi.balanceOf(recipient)
      expect(recipientBalanceAfter).to.bignumber.equal(recipientBalanceBefore.add(web3.utils.toBN(amount)))
    }
  })

  it("allows to claim vesting rewards", async () => {
    const vestingGrantsJson = JSON.parse(String(await fs.readFile(migrate2_4.merkleDistributorInfoPath)))
    if (!isMerkleDistributorInfo(vestingGrantsJson)) {
      throw new Error("Invalid merkle distributor info")
    }

    const sampledGrants = _.sampleSize(vestingGrantsJson.grants, 50)
    const indexToTokenId = {}
    for (const grant of sampledGrants) {
      const {
        index,
        proof,
        account: recipient,
        grant: {amount, vestingLength, cliffLength, vestingInterval},
      } = grant

      await impersonateAccount(hre, recipient)
      await fundWithWhales(["ETH"], [recipient])

      const rewardsAvailableBefore = await communityRewards.rewardsAvailable()
      const recipientBalanceBefore = await gfi.balanceOf(recipient)

      const receipt = await merkleDistributor.acceptGrant(
        index,
        amount,
        vestingLength,
        cliffLength,
        vestingInterval,
        proof,
        {from: recipient}
      )

      const grantedEvent = getOnlyLog<Granted>(decodeLogs(receipt.receipt.rawLogs, communityRewards, "Granted"))
      const tokenId = grantedEvent.args.tokenId
      indexToTokenId[index] = tokenId

      // verify grant properties
      const grantState = await communityRewards.grants(tokenId)
      assertCommunityRewardsVestingRewards(grantState)
      expect(grantState.totalGranted).to.bignumber.equal(web3.utils.toBN(amount))
      expect(grantState.totalClaimed).to.bignumber.equal(new BN(0))
      expect(grantState.vestingInterval).to.bignumber.equal(web3.utils.toBN(vestingInterval))
      expect(grantState.cliffLength).to.bignumber.equal(web3.utils.toBN(cliffLength))

      const claimable = await communityRewards.claimableRewards(tokenId)

      expect(claimable).to.bignumber.equal(web3.utils.toBN(0))
      await communityRewards.getReward(tokenId, {from: recipient})

      const rewardsAvailableAfter = await communityRewards.rewardsAvailable()
      expect(rewardsAvailableAfter).to.bignumber.equal(rewardsAvailableBefore.sub(web3.utils.toBN(amount)))

      const recipientBalanceAfter = await gfi.balanceOf(recipient)
      expect(recipientBalanceAfter).to.bignumber.equal(recipientBalanceBefore)
    }

    const vestingLength = 31536000

    if ((await time.latest()).lt(new BN(TOKEN_LAUNCH_TIME).add(web3.utils.toBN(vestingLength)))) {
      await advanceTime({toSecond: new BN(TOKEN_LAUNCH_TIME).add(web3.utils.toBN(vestingLength))})
      await hre.ethers.provider.send("evm_mine", [])
    }

    for (const grant of sampledGrants) {
      const {
        index,
        account: recipient,
        grant: {amount},
      } = grant

      const rewardsAvailableBefore = await communityRewards.rewardsAvailable()
      const recipientBalanceBefore = await gfi.balanceOf(recipient)

      await impersonateAccount(hre, recipient)

      const tokenId = indexToTokenId[index]
      const claimable = await communityRewards.claimableRewards(tokenId)
      expect(claimable).to.bignumber.equal(web3.utils.toBN(amount))

      await communityRewards.getReward(tokenId, {from: recipient})

      const rewardsAvailableAfter = await communityRewards.rewardsAvailable()
      expect(rewardsAvailableAfter).to.bignumber.equal(rewardsAvailableBefore)

      const recipientBalanceAfter = await gfi.balanceOf(recipient)
      expect(recipientBalanceAfter).to.bignumber.equal(recipientBalanceBefore.add(claimable))
    }
  })
})

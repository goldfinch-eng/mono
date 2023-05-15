import {
  assertIsChainId,
  getProtocolOwner,
  getTruffleContract,
  isMainnetForking,
  MAINNET_CHAIN_ID,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import * as migrate231 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.3.1/migrate"
import {expectOwnerRole, expectProxyOwner} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  CommunityRewardsInstance,
  GFIInstance,
  GoldfinchConfigInstance,
  MerkleDirectDistributorInstance,
  StakingRewardsInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {deployments, getChainId, getNamedAccounts} from "hardhat"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"

const v231PerformMigration = deployments.createFixture(async () => {
  await migrate231.main()
})

describe("V2.2 & v2.3 migration", async function () {
  this.timeout(TEST_TIMEOUT)
  let stakingRewards: StakingRewardsInstance
  let merkleDirectDistributor: MerkleDirectDistributorInstance
  let communityRewards: CommunityRewardsInstance

  before(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertNonNullable(gf_deployer)
    const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
    assertIsChainId(chainId)
  })

  const testSetup = deployments.createFixture(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertIsString(gf_deployer)
    await fundWithWhales(["ETH"], [gf_deployer])
    const newConfigDeployment = await deployments.get("GoldfinchConfig")
    const newConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {
      at: newConfigDeployment.address,
    })
    const stakingRewards = await getTruffleContract<StakingRewardsInstance>("StakingRewards")
    const gfi = await getTruffleContract<GFIInstance>("GFI", {
      at: await (await deployments.get("GFI")).address,
    })
    const merkleDirectDistributor = await getTruffleContract<MerkleDirectDistributorInstance>(
      "MerkleDirectDistributor",
      {
        at: (await deployments.get("MerkleDirectDistributor")).address,
      }
    )
    const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards", {
      at: (await deployments.get("CommunityRewards")).address,
    })
    return {newConfig, stakingRewards, gfi, merkleDirectDistributor, communityRewards}
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({stakingRewards, merkleDirectDistributor, communityRewards} = await testSetup())
  })

  expectProxyOwner({
    toBe: async () => getProtocolOwner(),
    forContracts: ["StakingRewards", "CommunityRewards", "GoldfinchConfig", "MerkleDirectDistributor"],
  })

  expectOwnerRole({
    toBe: async () => getProtocolOwner(),
    forContracts: ["StakingRewards", "CommunityRewards", "GoldfinchConfig", "MerkleDirectDistributor"],
  })

  describe("v2.3.1 migration", async () => {
    beforeEach(async () => {
      await v231PerformMigration()
    })

    describe("StakingRewards", async () => {
      it("is unpaused", async () => {
        expect(await stakingRewards.paused()).to.be.false
      })
    })

    describe("CommunityRewards", async () => {
      it("is unpaused", async () => {
        expect(await communityRewards.paused()).to.be.false
      })
    })

    describe("MerkleDirectDistributor", async () => {
      it("is unpaused", async () => {
        expect(await merkleDirectDistributor.paused()).to.be.false
      })
    })
  })
})

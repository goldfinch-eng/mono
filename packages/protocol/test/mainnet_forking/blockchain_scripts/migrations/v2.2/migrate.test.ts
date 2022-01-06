import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {
  assertIsChainId,
  getEthersContract,
  getProtocolOwner,
  getTruffleContract,
  isMainnetForking,
  MAINNET_CHAIN_ID,
  ZERO_ADDRESS,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {getAllExistingContracts} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import * as migrate231 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.3.1/migrate"
import * as migrate23 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.3/migrate"
import {Awaited} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import {expectOwnerRole, expectProxyOwner} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  Go,
  GoldfinchConfig,
  GoldfinchFactory,
  PoolTokens,
  SeniorPool,
  TestBackerRewards,
  UniqueIdentity,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {
  CommunityRewardsInstance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  MerkleDirectDistributorInstance,
  StakingRewardsInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import hre, {deployments, getChainId, getNamedAccounts} from "hardhat"
import {Deployment} from "hardhat-deploy/types"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"

const v23PerformMigration = deployments.createFixture(async ({deployments}) => {
  return await migrate23.main()
})

const v231PerformMigration = deployments.createFixture(async () => {
  await migrate231.main()
})

describe("V2.2 & v2.3 migration", async function () {
  this.timeout(TEST_TIMEOUT)
  let v23migration: Awaited<ReturnType<typeof migrate23.main>>
  let newConfig: GoldfinchConfigInstance
  let existingContracts
  let stakingRewards: StakingRewardsInstance
  let merkleDirectDistributor: MerkleDirectDistributorInstance
  let gfi: GFIInstance
  let communityRewards: CommunityRewardsInstance

  before(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertNonNullable(gf_deployer)
    const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
    assertIsChainId(chainId)

    existingContracts = await getAllExistingContracts(chainId)
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
    ;({gfi, newConfig, stakingRewards, gfi, merkleDirectDistributor, communityRewards} = await testSetup())
  })

  expectProxyOwner({
    toBe: async () => getProtocolOwner(),
    forContracts: ["StakingRewards", "CommunityRewards", "GoldfinchConfig", "MerkleDirectDistributor"],
  })

  expectOwnerRole({
    toBe: async () => getProtocolOwner(),
    forContracts: [
      "StakingRewards",
      "CommunityRewards",
      "GoldfinchConfig",
      "MerkleDirectDistributor",
      "DynamicLeverageRatioStrategy",
    ],
  })

  describe("v2.3 migration", () => {
    beforeEach(async () => {
      const {gf_deployer} = await getNamedAccounts()
      assertIsString(gf_deployer)
      await fundWithWhales(["ETH"], [gf_deployer])
    })

    context("token launch", async () => {
      let goldfinchConfigDeployment: Deployment, goldfinchConfig: GoldfinchConfig
      let goldfinchFactoryDeployment: Deployment, goldfinchFactory: GoldfinchFactory
      let goDeployment: Deployment, go: GoInstance
      beforeEach(async () => {
        v23migration = await v23PerformMigration()
        goldfinchConfigDeployment = await deployments.get("GoldfinchConfig")
        goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
          at: goldfinchConfigDeployment.address,
        })
        goldfinchFactoryDeployment = await deployments.get("GoldfinchFactory")
        goldfinchFactory = await getEthersContract<GoldfinchFactory>("GoldfinchFactory", {
          at: goldfinchFactoryDeployment.address,
        })
        goDeployment = await deployments.get("Go")
        go = await getTruffleContract<GoInstance>("Go", {at: goDeployment.address})
      })

      expectProxyOwner({
        toBe: () => getProtocolOwner(),
        forContracts: ["PoolTokens", "SeniorPool", "UniqueIdentity", "Go", "GoldfinchFactory", "TestBackerRewards"],
      })

      expectOwnerRole({
        toBe: () => getProtocolOwner(),
        forContracts: ["PoolTokens", "SeniorPool", "UniqueIdentity", "Go", "GoldfinchFactory", "TestBackerRewards"],
      })

      context("initialization", async () => {
        it("initializes all contracts", async () => {
          await impersonateAccount(hre, await getProtocolOwner())
          await fundWithWhales(["ETH"], [await getProtocolOwner()])

          await expect(
            (await getEthersContract<PoolTokens>("PoolTokens")).__initialize__(ZERO_ADDRESS, ZERO_ADDRESS)
          ).to.be.rejectedWith(/initialized/)
          await expect(
            (await getEthersContract<SeniorPool>("SeniorPool")).initialize(ZERO_ADDRESS, ZERO_ADDRESS)
          ).to.be.rejectedWith(/initialized/)
          await expect(
            (await getEthersContract<UniqueIdentity>("UniqueIdentity")).initialize(ZERO_ADDRESS, "http://example.com")
          ).to.be.rejectedWith(/initialized/)
          await expect(
            (await getEthersContract<Go>("Go")).initialize(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)
          ).to.be.rejectedWith(/initialized/)
          await expect(
            (await getEthersContract<GoldfinchFactory>("GoldfinchFactory")).initialize(ZERO_ADDRESS, ZERO_ADDRESS)
          ).to.be.rejectedWith(/initialized/)
          await expect(
            (await getEthersContract<TestBackerRewards>("TestBackerRewards")).__initialize__(ZERO_ADDRESS, ZERO_ADDRESS)
          ).to.be.rejectedWith(/initialized/)
        })
      })

      it("upgrades new contracts", async () => {
        const updateConfigContracts = ["PoolTokens", "SeniorPool", "UniqueIdentity", "Go"]
        for (const contractName of updateConfigContracts) {
          const newDeployment: Deployment = await deployments.get(contractName)
          const newUpgradedContract = v23migration.upgradedContracts[contractName]
          expect(newDeployment.address).to.eq(existingContracts[contractName]?.address)
          expect(newDeployment.address).to.eq(newUpgradedContract?.ProxyContract.address)
          expect(newDeployment.address).to.not.eq(newUpgradedContract?.UpgradedImplAddress)
          const contract = await getEthersContract(contractName)

          // UID has no knowledge of GoldfinchConfig
          if (contractName != "UniqueIdentity") {
            // config points to new contract
            expect(await goldfinchConfig.getAddress(CONFIG_KEYS[contractName])).to.eq(newDeployment.address)
            // contract points to goldfinch config
            expect(await contract.config()).to.eq(goldfinchConfig.address)
          }
        }
      })

      it("Deploy TranchedPool and set TranchedPoolImplementation to new contract", async () => {
        const newDeployment: Deployment = await deployments.get("TestTranchedPool")
        const newDeployedContract = v23migration.deployedContracts.tranchedPool
        expect(newDeployment.address).to.eq(newDeployedContract.address)
        expect(existingContracts.TranchedPool.address).to.not.eq(newDeployment.address)

        // config points to new contract
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)).to.eq(
          newDeployedContract.address
        )
        // note: contract.config() is 0x because it is deployed by deployMinimal in createPool
      })

      it("Deploy BackerRewards", async () => {
        const newDeployment: Deployment = await deployments.get("TestBackerRewards")
        const newDeployedContract = v23migration.deployedContracts.backerRewards
        expect(newDeployment.address).to.eq(newDeployedContract.address)
        console.log(await goldfinchConfig.getAddress(CONFIG_KEYS.BackerRewards))

        // config points to new contract
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS.BackerRewards)).to.eq(newDeployedContract.address)

        // contract points to goldfinch config
        const contract = await getEthersContract("TestBackerRewards")
        expect(await contract.config()).to.eq(goldfinchConfig.address)
      })

      describe("GoldfinchFactory", async () => {
        it("OWNER_ROLE is the admin of BORROWER_ROLE", async () => {
          const ownerRole = await goldfinchFactory.OWNER_ROLE()
          const borrowerRole = await goldfinchFactory.BORROWER_ROLE()
          expect(await goldfinchFactory.getRoleAdmin(borrowerRole)).to.be.eq(ownerRole)
        })
      })

      describe("Go", async () => {
        const KNOWN_ADDRESS_ON_GO_LIST = "0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2"
        const GOLDFINCH_CONFIG_ADDRESS_WITH_GO_LIST = "0x4eb844Ff521B4A964011ac8ecd42d500725C95CC"

        describe("allIdTypes", async () => {
          it("is initialized", async () => {
            expect(await go.allIdTypes(0)).to.bignumber.eq(await go.ID_TYPE_0())
            expect(await go.allIdTypes(1)).to.bignumber.eq(await go.ID_TYPE_1())
            expect(await go.allIdTypes(2)).to.bignumber.eq(await go.ID_TYPE_2())
            expect(await go.allIdTypes(3)).to.bignumber.eq(await go.ID_TYPE_3())
            expect(await go.allIdTypes(4)).to.bignumber.eq(await go.ID_TYPE_4())
            expect(await go.allIdTypes(5)).to.bignumber.eq(await go.ID_TYPE_5())
            expect(await go.allIdTypes(6)).to.bignumber.eq(await go.ID_TYPE_6())
            expect(await go.allIdTypes(7)).to.bignumber.eq(await go.ID_TYPE_7())
            expect(await go.allIdTypes(8)).to.bignumber.eq(await go.ID_TYPE_8())
            expect(await go.allIdTypes(9)).to.bignumber.eq(await go.ID_TYPE_9())
            expect(await go.allIdTypes(10)).to.bignumber.eq(await go.ID_TYPE_10())
          })
        })

        it("has the config with the go list set as the goListOverride", async () => {
          expect(await go.legacyGoList()).to.be.eq(GOLDFINCH_CONFIG_ADDRESS_WITH_GO_LIST)
        })

        it("config is not the null address", async () => {
          expect(await go.config()).to.not.eq("0x000000000000000000000000000000000000000000")
        })

        it("goListOverride is working correctly", async () => {
          expect(await go.go(KNOWN_ADDRESS_ON_GO_LIST)).to.be.true
          const goldfinchConfigDeployment = await deployments.get("GoldfinchConfig")
          const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
            at: goldfinchConfigDeployment.address,
          })

          expect(await goldfinchConfig.goList(KNOWN_ADDRESS_ON_GO_LIST)).to.be.false
        })
      })
    })
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

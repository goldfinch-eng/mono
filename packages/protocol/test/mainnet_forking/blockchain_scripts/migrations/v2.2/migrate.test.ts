import hre, {getNamedAccounts, deployments, getChainId, ethers} from "hardhat"
import {
  fundWithWhales,
  getAllExistingContracts,
  impersonateAccount,
} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import * as migrate22 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.2/migrate"
import * as migrate23 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.3/migrate"
import {
  assertIsChainId,
  DISTRIBUTOR_ROLE,
  getEthersContract,
  getProtocolOwner,
  getTruffleContract,
  isMainnetForking,
  MAINNET_CHAIN_ID,
  ZERO_ADDRESS,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {Awaited} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {Deployment} from "hardhat-deploy/types"
import {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {
  CommunityRewards,
  DynamicLeverageRatioStrategy,
  Go,
  GoldfinchConfig,
  GoldfinchFactory,
  MerkleDirectDistributor,
  PoolTokens,
  SeniorPool,
  StakingRewards,
  TestBackerRewards,
  TranchedPool,
  UniqueIdentity,
} from "@goldfinch-eng/protocol/typechain/ethers"
import poolMetadata from "@goldfinch-eng/client/config/pool-metadata/mainnet.json"
import {expectOwnerRole, expectProxyOwner, expectRoles} from "@goldfinch-eng/protocol/test/testHelpers"
import {GoInstance, GoldfinchConfigInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {StakingRewardsInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {STAKING_REWARDS_PARAMS} from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.2/deploy"

const v22PerformMigration = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})
  return await migrate22.main()
})

const v23PerformMigration = deployments.createFixture(async ({deployments}) => {
  return await migrate23.main()
})

describe("V2.2 & v2.3 migration", async function () {
  this.timeout(TEST_TIMEOUT)
  let v22migration: Awaited<ReturnType<typeof migrate22.main>>
  let v23migration: Awaited<ReturnType<typeof migrate23.main>>
  let newConfigDeployment: Deployment
  let newConfig: GoldfinchConfigInstance
  let existingContracts
  let oldConfigDeployment: Deployment
  let stakingRewards: StakingRewardsInstance

  before(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertNonNullable(gf_deployer)
    const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
    assertIsChainId(chainId)

    existingContracts = await getAllExistingContracts(chainId)
  })

  beforeEach(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertIsString(gf_deployer)
    await fundWithWhales(["ETH"], [gf_deployer])
    // migration = await performMigration()
    v22migration = await v22PerformMigration()
    newConfigDeployment = await deployments.get("GoldfinchConfig")
    newConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {
      at: newConfigDeployment.address,
    })
    stakingRewards = await getTruffleContract<StakingRewardsInstance>("StakingRewards")
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

  describe("v2.2 migration", () => {
    context("GoldfinchConfig", async () => {
      it("deploys a proxied GoldfinchConfig and initializes values", async () => {
        const newConfigDeployment = await deployments.get("GoldfinchConfig")
        const newConfig = v22migration.deployedContracts.config
        const oldConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
          at: existingContracts.GoldfinchConfig.address,
        })

        expect(newConfigDeployment.address).to.not.eq(existingContracts.GoldfinchConfig.address)
        expect(newConfigDeployment.address).to.eq(newConfig.address)

        for (const [k, v] of Object.entries(CONFIG_KEYS_BY_TYPE.numbers)) {
          expect((await oldConfig.getNumber(v)).toString(), k).to.eq((await newConfig.getNumber(v)).toString())
        }

        for (const [k, v] of Object.entries(CONFIG_KEYS_BY_TYPE.addresses)) {
          // Ignore GoldfinchConfig, since it should only be set in the old config
          // Ignore StakingRewards, since it gets deployed and set only in the new config
          // Ignore GFI, since it set only in the new config
          if (!["GoldfinchConfig", "StakingRewards", "GFI"].includes(k)) {
            expect(await oldConfig.getAddress(v), k).to.eq(await newConfig.getAddress(v))
          }
        }
      })

      context("StakingRewards", async () => {
        it("has expected parameters set", async () => {
          expect(await stakingRewards.minRate()).to.be.bignumber.eq(STAKING_REWARDS_PARAMS.minRate)
          expect(await stakingRewards.maxRate()).to.be.bignumber.eq(STAKING_REWARDS_PARAMS.maxRate)
          expect(await stakingRewards.minRateAtPercent()).to.be.bignumber.eq(STAKING_REWARDS_PARAMS.minRateAtPercent)
          expect(await stakingRewards.maxRateAtPercent()).to.be.bignumber.eq(STAKING_REWARDS_PARAMS.maxRateAtPercent)
        })
      })

      it("has GFI address set", async () => {
        const gfi = await deployments.get("GFI")
        const address = await expect(newConfig.getAddress(CONFIG_KEYS.GFI)).to.be.fulfilled
        expect(address).to.eq(gfi.address)
      })

      it("updates the config address on various contracts", async () => {
        const oldConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
          at: existingContracts.GoldfinchConfig.address,
        })
        const newConfig = v22migration.deployedContracts.config

        // Old config should have the new config's address set
        expect(await oldConfig.getAddress(CONFIG_KEYS.GoldfinchConfig)).to.eq(newConfig.address)

        // All of these contracts should point to the new config now
        const updateConfigContracts = [
          "Fidu",
          "FixedLeverageRatioStrategy",
          "GoldfinchFactory",
          "SeniorPool",
          "PoolTokens",
        ]
        for (const contractName of updateConfigContracts) {
          const contract = await getEthersContract(contractName)
          expect(await contract.config()).to.eq(newConfig.address)
        }

        // Existing TranchedPool should also point to new config now
        const tranchedPoolAddresses = Object.keys(poolMetadata)
        const tranchedPoolContracts = await Promise.all(
          tranchedPoolAddresses.map(async (address) => getEthersContract<TranchedPool>("TranchedPool", {at: address}))
        )
        for (const tranchedPool of tranchedPoolContracts) {
          expect(await tranchedPool.config()).to.eq(newConfig.address)
        }
      })
    })

    context("token launch", async () => {
      it("deploys staking / airdrop contracts", async () => {
        for (const contractName of ["StakingRewards", "CommunityRewards"]) {
          await expect(deployments.get(contractName)).to.not.be.rejected
        }
      })

      it("deploys merkle distributors", async () => {
        for (const contractName of ["MerkleDistributor", "MerkleDirectDistributor"]) {
          await expect(deployments.get(contractName)).to.not.be.rejected
        }
      })

      expectRoles([
        {
          contractName: "CommunityRewards",
          roles: [DISTRIBUTOR_ROLE],
          address: async () => (await deployments.get("MerkleDistributor")).address,
        },
      ])

      // it("mints and distributes GFI to the correct addresses", async () => {})
    })

    context("other contracts", async () => {
      it("deploys DynamicLeverageRatioStrategy", async () => {
        await expect(deployments.get("DynamicLeverageRatioStrategy")).to.not.be.rejected
      })
    })

    context("initialization", async () => {
      it("initializes all contracts", async () => {
        await impersonateAccount(hre, await getProtocolOwner())
        await fundWithWhales(["ETH"], [await getProtocolOwner()])
        await expect(
          (await getEthersContract<StakingRewards>("StakingRewards")).__initialize__(ZERO_ADDRESS, ZERO_ADDRESS)
        ).to.be.rejectedWith(/initialized/)
        await expect(
          (
            await getEthersContract<CommunityRewards>("CommunityRewards")
          ).__initialize__(ZERO_ADDRESS, ZERO_ADDRESS, "12345")
        ).to.be.rejectedWith(/initialized/)
        await expect(
          (await getEthersContract<GoldfinchConfig>("GoldfinchConfig")).initialize(ZERO_ADDRESS)
        ).to.be.rejectedWith(/initialized/)
        await expect(
          (
            await getEthersContract<MerkleDirectDistributor>("MerkleDirectDistributor")
          ).initialize(ZERO_ADDRESS, ZERO_ADDRESS, web3.utils.keccak256("test"))
        ).to.be.rejectedWith(/initialized/)
        await expect(
          (
            await getEthersContract<DynamicLeverageRatioStrategy>("DynamicLeverageRatioStrategy")
          ).initialize(ZERO_ADDRESS)
        ).to.be.rejectedWith(/initialized/)
      })
    })
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
})

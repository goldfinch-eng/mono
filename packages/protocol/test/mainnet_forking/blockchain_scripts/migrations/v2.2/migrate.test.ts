import {ethers, getNamedAccounts, deployments} from "hardhat"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {assertIsString} from "@goldfinch-eng/utils"
import * as migrate from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.2/migrate"
import {
  ETHDecimals,
  getEthersContract,
  getProtocolOwner,
  MINTER_ROLE,
  OWNER_ROLE,
  PAUSER_ROLE,
  SIGNER_ROLE,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {Awaited} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {Deployment} from "hardhat-deploy/types"
import {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {GoldfinchConfig, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
import poolMetadata from "@goldfinch-eng/client/config/pool-metadata/mainnet.json"

const performMigration = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})
  return await migrate.main()
})

export function expectProxyOwner({toBe, forContracts}: {toBe: () => Promise<string>; forContracts: string[]}) {
  describe("proxy owners", async () => {
    forContracts.forEach((contractName) => {
      it(`sets the correct proxy owner for ${contractName}`, async () => {
        const proxyDeployment = await deployments.get(`${contractName}_Proxy`)
        const proxyContract = await ethers.getContractAt(proxyDeployment.abi, proxyDeployment.address)
        expect(await proxyContract.owner()).to.eq(await toBe())
      })
    })
  })
}

export type RoleExpectation = {contractName: string; roles: string[]; address: () => Promise<string>}
export function expectRoles(expectations: RoleExpectation[]) {
  describe("roles", async () => {
    for (const {contractName, roles, address} of expectations) {
      for (const role of roles) {
        it(`assigns the ${role} role`, async () => {
          const addr = await address()
          const deployment = await deployments.get(contractName)
          const contract = await ethers.getContractAt(deployment.abi, deployment.address)

          expect(await contract.hasRole(role, addr)).to.be.true
        })
      }
    }
  })
}

describe("v2.2 migration", async function () {
  this.timeout(TEST_TIMEOUT)

  let oldConfigDeployment: Deployment
  let migration: Awaited<ReturnType<typeof migrate.main>>

  before(async () => {
    // We need to store the old config address because deployments don't get reset
    // due to the use of keepExistingDeployments above (which is needed for mainnet-forking tests)
    oldConfigDeployment = await deployments.get("GoldfinchConfig")
  })

  beforeEach(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertIsString(gf_deployer)
    await fundWithWhales(["ETH"], [gf_deployer])
    migration = await performMigration()
  })

  expectProxyOwner({
    toBe: async () => getProtocolOwner(),
    forContracts: ["StakingRewards", "CommunityRewards"],
  })

  context("GoldfinchConfig", async () => {
    it("deploys a proxied GoldfinchConfig and initializes values", async () => {
      const newConfigDeployment = await deployments.get("GoldfinchConfig")
      const newConfig = migration.deployedContracts.config
      const oldConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
        at: oldConfigDeployment.address,
      })

      expect(newConfigDeployment.address).to.not.eq(oldConfigDeployment.address)
      expect(newConfigDeployment.address).to.eq(newConfig.address)

      for (const [k, v] of Object.entries(CONFIG_KEYS_BY_TYPE.numbers)) {
        expect((await oldConfig.getNumber(v)).toString(), k).to.eq((await newConfig.getNumber(v)).toString())
      }

      for (const [k, v] of Object.entries(CONFIG_KEYS_BY_TYPE.addresses)) {
        // Ignore GoldfinchConfig, since it should only be set in the old config
        // Ignore StakingRewards, since it gets deployed and set only in the new config
        if (!["GoldfinchConfig", "StakingRewards"].includes(k)) {
          expect(await oldConfig.getAddress(v), k).to.eq(await newConfig.getAddress(v))
        }
      }
    })

    it("updates the config address on various contracts", async () => {
      const oldConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
        at: oldConfigDeployment.address,
      })
      const newConfig = migration.deployedContracts.config

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

    // it("deploys merkle distributors", async () => {
    //   for (const contractName of ["MerkleDistributor", "MerkleDirectDistributor"]) {
    //     await expect(deployments.get(contractName)).to.not.be.rejected
    //   }
    // })

    // expectRoles([
    //   {
    //     contractName: "CommunityRewards",
    //     roles: [SIGNER_ROLE],
    //     address: async () => (await deployments.get("MerkleDistributor")).address,
    //   },
    // ])

    // it("mints and distributes GFI to the correct addresses", async () => {})
  })

  context("other contracts", async () => {
    it("deploys DynamicLeverageRatioStrategy", async () => {
      await expect(deployments.get("DynamicLeverageRatioStrategy")).to.not.be.rejected
    })
  })
})

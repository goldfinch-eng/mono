import {getNamedAccounts, deployments} from "hardhat"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {assertIsString} from "@goldfinch-eng/utils"
import * as migrate from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.3/migrate"
import {getEthersContract} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {Awaited} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {Deployment} from "hardhat-deploy/types"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"

const performMigration = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})
  return await migrate.main()
})

describe("v2.3 migration", async function () {
  this.timeout(TEST_TIMEOUT)

  let oldConfigDeployment: Deployment
  let migration: Awaited<ReturnType<typeof migrate.main>>
  // let oldGo, oldSeniorPool, oldUniqueIdentity, oldPoolTokens

  // before(async () => {
  // We need to store the old config address because deployments don't get reset
  // due to the use of keepExistingDeployments above (which is needed for mainnet-forking tests)
  // oldConfigDeployment = await deployments.get("GoldfinchConfig")
  // oldGo = await deployments.get("Go")
  // oldSeniorPool = await deployments.get("SeniorPool")
  // oldUniqueIdentity = await deployments.get("UniqueIdentity")
  // oldPoolTokens = await deployments.get("PoolTokens")
  // })

  beforeEach(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertIsString(gf_deployer)
    await fundWithWhales(["ETH"], [gf_deployer])
  })

  context("token launch", async () => {
    beforeEach(async () => {
      migration = await performMigration()
    })
    it("upgrades new contracts", async () => {
      // const newGoDeployment = await deployments.get("Go")
      // const newSeniorPoolDeployment = await deployments.get("SeniorPool")
      // const newUniqueIdentityDeployment = await deployments.get("UniqueIdentity")
      // const newPoolTokensDeployment = await deployments.get("PoolTokens")
      // const newGo = migration.upgradedContracts.go
      // const newSeniorPool = migration.upgradedContracts.seniorPool
      // const newUniqueIdentity = migration.upgradedContracts.uniqueIdentity
      const newPoolTokens = migration.upgradedContracts.poolTokens

      console.log(oldPoolTokens.address)
      console.log(newPoolTokens?.UpgradedContract.address)

      // const newConfigDeployment = await deployments.get("GoldfinchConfig")
      // const newConfig = migration.deployedContracts.config
      // const oldConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
      //   at: oldConfigDeployment.address,
      // })

      const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
        at: oldConfigDeployment.address,
      })

      // Old config should have the new config's address set
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.GoldfinchConfig)).to.eq(goldfinchConfig.address)

      const updateConfigContracts = ["SeniorPool", "PoolTokens", "Go", "UniqueIdentity"]
      for (const contractName of updateConfigContracts) {
        const contract = await getEthersContract(contractName)
        // contract points to goldfinch config
        expect(await contract.config()).to.eq(goldfinchConfig.address)
        // config points to new contract
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS[contractName])).to.eq(await contract.config())
      }
    })

    // it("deploy tranchedpool and set tranchedpoolimplementation", async () => {})

    // it("deploy backer rewards", async () => {})
  })
})

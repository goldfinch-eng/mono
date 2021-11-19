import {getNamedAccounts, deployments} from "hardhat"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {assertIsString} from "@goldfinch-eng/utils"
import * as migrate22 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.2/migrate"
import * as migrate from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.3/migrate"
import {getEthersContract} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {Awaited} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {Deployment} from "hardhat-deploy/types"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"

const performMigration = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})
  await migrate22.main()
  return await migrate.main()
})

describe.only("v2.3 migration", async function () {
  this.timeout(TEST_TIMEOUT)

  let migration: Awaited<ReturnType<typeof migrate.main>>
  let oldConfigDeployment: Deployment, oldGoDeployment: Deployment, oldSeniorPoolDeployment: Deployment, oldUniqueIdentityDeployment: Deployment, oldPoolTokensDeployment: Deployment

  before(async () => {
    // We need to store the old config address because deployments don't get reset
    // due to the use of keepExistingDeployments above (which is needed for mainnet-forking tests)
    oldConfigDeployment = await deployments.get("GoldfinchConfig")
    oldGoDeployment = await deployments.get("Go")
    oldSeniorPoolDeployment = await deployments.get("SeniorPool")
    oldUniqueIdentityDeployment = await deployments.get("UniqueIdentity")
    oldPoolTokensDeployment = await deployments.get("PoolTokens")
  })

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
      const newGoDeployment: Deployment = await deployments.get("Go")
      const newGo = migration.upgradedContracts.Go

      const newSeniorPoolDeployment: Deployment = await deployments.get("SeniorPool")
      const newSeniorPool = migration.upgradedContracts.SeniorPool

      const newUniqueIdentityDeployment: Deployment = await deployments.get("UniqueIdentity")
      const newUniqueIdentity = migration.upgradedContracts.UniqueIdentity

      const newPoolTokensDeployment: Deployment = await deployments.get("PoolTokens")
      const newPoolTokens = migration.upgradedContracts.PoolTokens

      console.log('oldPoolTokens.address', oldPoolTokensDeployment.address)
      console.log('newPoolTokensDeployment.address', newPoolTokensDeployment.address)
      console.log('PoolTokens?.ProxyContract.address', newPoolTokens?.ProxyContract.address)
      console.log('PoolTokens?.UpgradedImplAddress', newPoolTokens?.UpgradedImplAddress)
      // expect(newPoolTokensDeployment.address).to.not.eq(oldPoolTokensDeployment.address)
      // expect(newPoolTokensDeployment.address).to.eq(newPoolTokensDeployment.address)


      const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
        at: oldConfigDeployment.address,
      })

      const updateConfigContracts = ["SeniorPool", "PoolTokens", "Go", "UniqueIdentity"]
      for (const contractName of updateConfigContracts) {
        const contract = await getEthersContract(contractName)
        // contract points to goldfinch config
        expect(await contract.config()).to.eq(goldfinchConfig.address)

        // config points to new contract
        console.log(contractName, await goldfinchConfig.getAddress(CONFIG_KEYS[contractName]))
        console.log(contractName, contract.address)
        expect(await goldfinchConfig.getAddress(CONFIG_KEYS[contractName])).to.eq(contract.address)
      }
    })

    it("deploy tranchedpool and set tranchedpoolimplementation", async () => {
      // const newTranchedPoolDeployment: Deployment = await deployments.get("Go")
      const newTranchedPool = migration.deployedContracts.tranchedPool

      // make sure goldfinch config address is set
      // expect(await goldfinchConfig.getAddress(CONFIG_KEYS[contractName])).to.eq(contract.address)

    })

    it("deploy backer rewards", async () => {
      const newBackerRewards = migration.deployedContracts.backerRewards

      // make sure goldfinch config address is set
    })
  })
})

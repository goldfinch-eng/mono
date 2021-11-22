import {getNamedAccounts, deployments} from "hardhat"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {assertIsString} from "@goldfinch-eng/utils"
import * as migrate22 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.2/migrate"
import * as migrate from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.3/migrate"
import {getEthersContract, getTruffleContract} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {Awaited} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {Deployment} from "hardhat-deploy/types"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {GoInstance} from "@goldfinch-eng/protocol/typechain/truffle"

const performMigration = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})
  await migrate22.main()
  return await migrate.main()
})

describe("v2.3 migration", async function () {
  this.timeout(TEST_TIMEOUT)

  let migration: Awaited<ReturnType<typeof migrate.main>>
  let oldGoDeployment: Deployment,
    oldSeniorPoolDeployment: Deployment,
    oldUniqueIdentityDeployment: Deployment,
    oldPoolTokensDeployment: Deployment,
    oldTranchedPoolDeployment: Deployment,
    oldGoldfinchConfigDeployment: Deployment

  let oldDeployments: {
    [key: string]: Deployment
  }

  before(async () => {
    // We need to store the old config address because deployments don't get reset
    // due to the use of keepExistingDeployments above (which is needed for mainnet-forking tests)
    oldGoDeployment = await deployments.get("Go")
    oldSeniorPoolDeployment = await deployments.get("SeniorPool")
    oldUniqueIdentityDeployment = await deployments.get("UniqueIdentity")
    oldPoolTokensDeployment = await deployments.get("PoolTokens")
    oldTranchedPoolDeployment = await deployments.get("TranchedPool")
    oldGoldfinchConfigDeployment = await deployments.get("GoldfinchConfig")
    oldDeployments = {
      PoolTokens: oldPoolTokensDeployment,
      UniqueIdentity: oldUniqueIdentityDeployment,
      SeniorPool: oldSeniorPoolDeployment,
      Go: oldGoDeployment,
    }
  })

  beforeEach(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertIsString(gf_deployer)
    await fundWithWhales(["ETH"], [gf_deployer])
  })

  context("token launch", async () => {
    let goldfinchConfigDeployment: Deployment, goldfinchConfig: GoldfinchConfig
    let goDeployment: Deployment, go: GoInstance
    beforeEach(async () => {
      migration = await performMigration()
      goldfinchConfigDeployment = await deployments.get("GoldfinchConfig")
      goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
        at: goldfinchConfigDeployment.address,
      })
      goDeployment = await deployments.get("Go")
      go = await getTruffleContract<GoInstance>("Go", {at: goDeployment.address})
    })
    it("upgrades new contracts", async () => {
      const updateConfigContracts = ["PoolTokens", "SeniorPool", "UniqueIdentity", "Go"]
      for (const contractName of updateConfigContracts) {
        const newDeployment: Deployment = await deployments.get(contractName)
        const newUpgradedContract = migration.upgradedContracts[contractName]
        expect(newDeployment.address).to.eq(oldDeployments[contractName]?.address)
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
      const newDeployedContract = migration.deployedContracts.tranchedPool
      expect(newDeployment.address).to.eq(newDeployedContract.address)
      expect(oldTranchedPoolDeployment.address).to.not.eq(newDeployment.address)

      // config points to new contract
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)).to.eq(
        newDeployedContract.address
      )
      // note: contract.config() is 0x because it is deployed by deployMinimal in createPool
    })

    it("Deploy BackerRewards", async () => {
      const newDeployment: Deployment = await deployments.get("TestBackerRewards")
      const newDeployedContract = migration.deployedContracts.backerRewards
      expect(newDeployment.address).to.eq(newDeployedContract.address)
      console.log(await goldfinchConfig.getAddress(CONFIG_KEYS.BackerRewards))

      // config points to new contract
      expect(await goldfinchConfig.getAddress(CONFIG_KEYS.BackerRewards)).to.eq(newDeployedContract.address)

      // contract points to goldfinch config
      const contract = await getEthersContract("TestBackerRewards")
      expect(await contract.config()).to.eq(goldfinchConfig.address)
    })

    describe("Go", async () => {
      const KNOWN_ADDRESS_ON_GO_LIST = "0x483e2BaF7F4e0Ac7D90c2C3Efc13c3AF5050F3c2"
      it("has the config with the go list set as the goListOverride", async () => {
        expect(await go.goListOverride()).to.be.eq(oldGoldfinchConfigDeployment.address)
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

    // it(write tests for storage slots)
  })
})

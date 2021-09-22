import {deployments} from "hardhat"
import {getDeployedAsTruffleContract} from "./testHelpers"
import {expectEvent} from "@openzeppelin/test-helpers"

describe("GoldfinchFactory", async () => {
  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const {protocol_owner: owner} = await getNamedAccounts()
    await deployments.run("base_deploy")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")
    const goldfinchFactory = await getDeployedAsTruffleContract(deployments, "GoldfinchFactory")

    return {goldfinchFactory, goldfinchConfig}
  })

  let owner, goldfinchFactory, goldfinchConfig
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner] = await web3.eth.getAccounts()
    const deployments = await testSetup()
    goldfinchFactory = deployments.goldfinchFactory
    goldfinchConfig = deployments.goldfinchConfig
  })

  describe("updateGoldfinchConfig", async () => {
    describe("setting it", async () => {
      it("emits an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})
        await goldfinchConfig.setGoldfinchConfig(newConfig.address, {from: owner})
        const tx = await goldfinchFactory.updateGoldfinchConfig({from: owner})
        expectEvent(tx, "GoldfinchConfigUpdated", {
          who: owner,
          configAddress: newConfig.address,
        })
      })
    })
  })
})

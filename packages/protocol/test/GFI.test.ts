import {deployments} from "hardhat"
import {getDeployedAsTruffleContract} from "./testHelpers"
import {expectEvent} from "@openzeppelin/test-helpers"

const BEFORE_EACH_TIMEOUT = 30000

describe("GFI", () => {
  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    await deployments.run("base_deploy")
    const gfi = await getDeployedAsTruffleContract(deployments, "GFI")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")

    return {gfi, goldfinchConfig}
  })

  let owner, gfi, goldfinchConfig
  beforeEach(async function () {
    this.timeout(BEFORE_EACH_TIMEOUT)

    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner] = await web3.eth.getAccounts()
    const deployments = await testSetup()
    gfi = deployments.gfi
    goldfinchConfig = deployments.goldfinchConfig
  })

  describe("updateGoldfinchConfig", () => {
    describe("setting it", () => {
      it("emits an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})
        await goldfinchConfig.setGoldfinchConfig(newConfig.address, {from: owner})
        const tx = await gfi.updateGoldfinchConfig({from: owner})
        expectEvent(tx, "GoldfinchConfigUpdated", {
          who: owner,
          configAddress: newConfig.address,
        })
      })
    })
  })
})

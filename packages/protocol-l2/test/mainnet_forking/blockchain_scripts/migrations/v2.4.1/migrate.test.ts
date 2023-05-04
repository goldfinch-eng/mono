import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {getEthersContract, getProtocolOwner} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate241 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.4.1/migrate"
import {mochaEach} from "@goldfinch-eng/protocol/test/testHelpers"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("baseDeploy", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])
})

const performV241Deployment = deployments.createFixture(async () => {
  await migrate241.main()
})

describe("v2.4.1", async () => {
  beforeEach(async () => {
    await setupTest()
  })

  describe("after deploy", async () => {
    beforeEach(async () => {
      await performV241Deployment()
    })

    mochaEach(migrate241.repaidPoolAddressesToPauseDrawdowns).it(
      "pool at %s should have drawdowns paused",
      async (address) => {
        const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: address})
        expect(await tranchedPool.drawdownsPaused()).to.be.true
      }
    )
  })
})

import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import hre, {deployments, getNamedAccounts} from "hardhat"
import {getEthersContract, getProtocolOwner} from "packages/protocol/blockchain_scripts/deployHelpers"
import {assertIsString} from "packages/utils/src/type"

import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import * as migrate290 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v3.0/migrate3_0_0"
import {StakingRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {}
})

describe("v3.0.0", async function () {
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    await setupTest()
  })

  const setupAfterDeploy = deployments.createFixture(async () => {
    return await migrate290.main()
  })

  describe("after deploy", async () => {
    let stakingRewards: StakingRewards

    beforeEach(async () => {
      await setupAfterDeploy()
      stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
    })

    describe.skip("StakingRewards", async () => {
      it("uses GCP baseURI for tokenURI(tokenId) calls", async () => {
        expect(await stakingRewards.tokenURI(550)).to.eq(
          "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/stakingRewardsTokenMetadata/550"
        )
      })
    })
  })
})

import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {getEthersContract, getProtocolOwner} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate270 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.7.0/migrate"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {PoolTokens} from "@goldfinch-eng/protocol/typechain/ethers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {}
})

describe("v2.7.0", async function () {
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    await setupTest()
  })

  const setupAfterDeploy = deployments.createFixture(async () => {
    return await migrate270.main()
  })

  describe("after deploy", async () => {
    let poolTokens: PoolTokens

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      await setupAfterDeploy()
      poolTokens = await getEthersContract<PoolTokens>("PoolTokens")
    })

    describe("PoolTokens", async () => {
      it("uses GCP baseURI for tokenURI(tokenId) calls", async () => {
        expect(await poolTokens.tokenURI(550)).to.eq(
          "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/poolTokenMetadata/550"
        )
      })
    })
  })
})

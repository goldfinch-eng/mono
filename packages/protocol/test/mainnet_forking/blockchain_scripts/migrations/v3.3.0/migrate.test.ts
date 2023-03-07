import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {deployments} from "hardhat"
import {getProtocolOwner, getTruffleContract} from "packages/protocol/blockchain_scripts/deployHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {GoldfinchFactoryInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {MAINNET_WARBLER_LABS_MULTISIG} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  await fundWithWhales(["USDC"], [await getProtocolOwner()])
  await fundWithWhales(["GFI"], [await getProtocolOwner()])

  return {
    gfFactory: await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory"),
  }
})

describe("v3.3.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let gfFactory: GoldfinchFactoryInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({gfFactory} = await setupTest())
  })

  describe("GoldfinchFactory", async () => {
    it("has granted the borrower role to '0x229Db88850B319BD4cA751490F3176F511823372'", async () => {
      const borrowerRole = await gfFactory.BORROWER_ROLE()
      expect(MAINNET_WARBLER_LABS_MULTISIG).to.eq("0x229Db88850B319BD4cA751490F3176F511823372")
      await expect(gfFactory.hasRole(borrowerRole, "0x229Db88850B319BD4cA751490F3176F511823372")).to.eventually.be.true
    })
  })
})

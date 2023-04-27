import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {deployments} from "hardhat"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
} from "packages/protocol/blockchain_scripts/deployHelpers"

import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {usdcVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  MembershipOrchestratorInstance,
  ERC20Instance,
  TranchedPoolInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  await fundWithWhales(["USDC"], [await getProtocolOwner()])
  await fundWithWhales(["GFI"], [await getProtocolOwner()])

  return {
    membershipOrchestrator: await getTruffleContract<any>("MembershipOrchestrator"),
    usdc: await getTruffleContract<any>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)}),
  }
})

const ensurePoolIsOnTimeAndHasDisbursement = async (
  usdc: ERC20Instance,
  poolAddress: string,
  value = usdcVal(100_000)
) => {
  await usdc.approve(poolAddress, value)
  await (
    await getTruffleContract<TranchedPoolInstance>("TranchedPool", {
      at: poolAddress,
    })
  ).pay(value)
}

describe("v3.1.2", async function () {
  this.timeout(TEST_TIMEOUT)

  let membershipOrchestrator: MembershipOrchestratorInstance, usdc: ERC20Instance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({membershipOrchestrator, usdc} = await setupTest())
  })

  // Use The Graph to relevant tokens and pools for these tests. Plug the following graphql
  // into https://thegraph.com/hosted-service/subgraph/goldfinch-eng/goldfinch-v2 then use
  // the output (asset id and owner) in the test expectation.
  //
  // {
  //   vaultedPoolTokens(
  //     where: {tranchedPool_: {id: "<pool address of interest - lowercased!>"}}
  //   ) {
  //     poolToken {
  //       vaultedAsset {
  //         id
  //         user {
  //           id
  //         }
  //       }
  //     }
  //   }
  // }

  describe("harvest", () => {
    it("would harvest an old pool token", async () => {
      // Pool address options for graphql query:
      // 0xefeb69edf6b6999b0e3f2fa856a2acf3bdea4ab5
      // 0xaa2ccc5547f64c5dffd0a624eb4af2543a67ba65
      // 0xc9bdd0d3b80cc6efe79a82d850f44ec9b55387ae
      // 0xe6c30756136e07eb5268c3232efbfbe645c1ba5a
      // 0x1d596d28a7923a22aa013b0e7082bba23daa656b

      await ensurePoolIsOnTimeAndHasDisbursement(usdc, "0xe6c30756136e07eb5268c3232efbfbe645c1ba5a")

      await expect(membershipOrchestrator.harvest.call([102], {from: "0xd4de9f0fa7c40853146ad4994bb3a52615ffdb40"})).to
        .not.be.rejected
    })

    it("would harvest an old pool token for 0x418749e294cAbce5A714EfcCC22a8AAde6F9dB57", async () => {
      // Pool address options for graphql query:
      // 0x418749e294cabce5a714efccc22a8aade6f9db57

      await ensurePoolIsOnTimeAndHasDisbursement(usdc, "0x418749e294cAbce5A714EfcCC22a8AAde6F9dB57")

      await expect(membershipOrchestrator.harvest.call([128], {from: "0xcb726f13479963934e91b6f34b6e87ec69c21bb9"})).to
        .not.be.rejected
    })

    it("would harvest an old pool token for non-US or accredited", async () => {
      // Pool address options for graphql query:
      // 0x00c27fc71b159a346e179b4a1608a0865e8a7470
      // 0xd09a57127bc40d680be7cb061c2a6629fe71abef

      await ensurePoolIsOnTimeAndHasDisbursement(usdc, "0x00c27fc71b159a346e179b4a1608a0865e8a7470")

      await expect(membershipOrchestrator.harvest.call([277], {from: "0x850d3158d7bd0090b1c12d800c9e0ecf6410c846"})).to
        .not.be.rejected
    })

    it("would harvest an old pool token for non US accredited", async () => {
      // Pool address options for graphql query:
      // 0xb26b42dd5771689d0a7faeea32825ff9710b9c11
      // 0x759f097f3153f5d62ff1c2d82ba78b6350f223e3
      // 0x89d7c618a4eef3065da8ad684859a547548e6169

      await ensurePoolIsOnTimeAndHasDisbursement(usdc, "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3")

      await expect(membershipOrchestrator.harvest.call([196], {from: "0x5fbf1ca4f0579e8df632a3857899985584501484"})).to
        .not.be.rejected
    })

    it("would harvest a modern pool token ", async () => {
      // Pool address options for graphql query:
      // 0x538473c3a69da2b305cf11a40cf2f3904de8db5f

      await ensurePoolIsOnTimeAndHasDisbursement(usdc, "0x538473c3a69da2b305cf11a40cf2f3904de8db5f")

      await expect(membershipOrchestrator.harvest.call([244], {from: "0x0b4ecf28692614c10deb7d8579f4878be3fd2de9"})).to
        .not.be.rejected
    })
  })
})

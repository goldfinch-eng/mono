import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {getEthersContract, getProtocolOwner} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate270 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.7.0/migrate"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {PoolTokens} from "@goldfinch-eng/protocol/typechain/ethers"
import {MAINNET_MULTISIG} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"

import BN from "bn.js"

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

      describe("royalty standard", async () => {
        it("sets royalty percent to 50 bips", async () => {
          const FIFTY_BASIS_POINTS = String(5e15)

          const royaltyParams = await poolTokens.royaltyParams()
          expect(royaltyParams.royaltyPercent.toString()).to.eq(FIFTY_BASIS_POINTS)

          // Check that it results in the expected royalty share for a sample token
          const tokenId = "1"
          const salePrice = new BN(String(100e18))
          const royaltyInfo = await poolTokens.royaltyInfo(tokenId, salePrice.toString())

          const expectedRoyaltyAmount = salePrice.mul(new BN(FIFTY_BASIS_POINTS)).div(new BN(String(1e18)))
          expect(royaltyInfo[0]).to.eq(MAINNET_MULTISIG)
          expect(royaltyInfo[1].toString()).to.eq(expectedRoyaltyAmount.toString())
          // Royalty amount should be 0.5e18 since sale price is 100e18
          expect(royaltyInfo[1].toString()).to.eq(String(5e17))
        })

        it("sets goldfinch multisig as royalty receiver", async () => {
          const royaltyParams = await poolTokens.royaltyParams()
          expect(royaltyParams.receiver).to.eq(MAINNET_MULTISIG)
        })
      })
    })
  })
})

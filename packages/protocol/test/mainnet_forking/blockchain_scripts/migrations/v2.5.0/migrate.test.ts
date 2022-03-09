import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {
  getProtocolOwner,
  getTruffleContract,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate250 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5.0/migrate"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  BackerRewardsInstance,
  CommunityRewardsInstance,
  GFIInstance,
  GoldfinchConfigInstance,
  SeniorPoolInstance,
  ZapperInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"

const performV250Migration = deployments.createFixture(async () => {
  return await migrate250.main()
})

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const gfi = await getTruffleContract<GFIInstance>("GFI")
  const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards")
  const goldfinchConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig")
  const backerRewards = await getTruffleContract<BackerRewardsInstance>("BackerRewards")
  const seniorPool = await getTruffleContract<SeniorPoolInstance>("SeniorPool")

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {
    gfi,
    goldfinchConfig,
    communityRewards,
    backerRewards,
    seniorPool,
  }
})

describe("v2.5.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let gfi: GFIInstance
  let goldfinchConfig: GoldfinchConfigInstance
  let backerRewards: BackerRewardsInstance
  let communityRewards: CommunityRewardsInstance
  let seniorPool: SeniorPoolInstance

  let tranchedPoolImplAddressBeforeDeploy: string
  let leverageRatioStrategyAddressBeforeDeploy: string

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({gfi, goldfinchConfig, backerRewards, communityRewards, seniorPool} = await setupTest())

    tranchedPoolImplAddressBeforeDeploy = await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)
    leverageRatioStrategyAddressBeforeDeploy = await goldfinchConfig.getAddress(CONFIG_KEYS.LeverageRatio)
  })

  describe("after deploy", async () => {
    let params
    let zapper: ZapperInstance
    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({params} = await performV250Migration())
      zapper = await getTruffleContract<ZapperInstance>("Zapper")
    })

    describe("GoldfinchConfig", async () => {
      describe("getAddress", async () => {
        describe("TranchedPool", async () => {
          it("is upgraded", async () => {
            expect(await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)).to.not.eq(
              tranchedPoolImplAddressBeforeDeploy
            )
          })
        })

        describe("LeverageRatio", async () => {
          it("is correct", async () => {
            expect(await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)).to.not.eq(
              leverageRatioStrategyAddressBeforeDeploy
            )
          })
        })

        describe("FiduUSDCCurveLP", async () => {
          it("is correct", async () => {
            expect(await goldfinchConfig.getAddress(CONFIG_KEYS.FiduUSDCCurveLP)).to.be.eq(
              MAINNET_FIDU_USDC_CURVE_LP_ADDRESS
            )
          })
        })

        describe("Zapper", async () => {
          // TODO: put zapper tests here
        })
      })
    })

    describe("Zapper", async () => {
      // TODO
    })

    describe("GFI", async () => {
      describe("balanceOf", async () => {
        describe("BackerRewards", async () => {
          it("is correct", async () => {
            expect((await gfi.balanceOf(backerRewards.address)).toString()).to.bignumber.eq(
              params.backerRewards.totalRewards
            )
          })
        })
      })
    })

    describe("BackerRewards", async () => {
      describe("maxInterestDollarsElligible", async () => {
        it("is correct", async () => {
          expect(await backerRewards.maxInterestDollarsEligible()).to.bignumber.eq(
            params.backerRewards.maxInterestDollarsEligible
          )
        })
      })

      describe("totalRewardPercentOfTotalGFI", async () => {
        it("is correct", async () => {
          const two = "2000000000000000000"
          expect((await backerRewards.totalRewardPercentOfTotalGFI()).toString()).to.eq(two)
        })
      })
    })

    describe("StakingRewards", async () => {
      describe("effectiveMultiplier", async () => {
        it.skip("is correct", async () => {
          // TODO:
        })
      })
    })
  })
})

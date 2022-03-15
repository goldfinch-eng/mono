import hre, {deployments, getNamedAccounts} from "hardhat"
import {asNonNullable, assertIsString} from "packages/utils/src/type"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate250 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5.0/migrate"
import * as migrate260 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.6.0/migrate"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  BackerRewardsInstance,
  CommunityRewardsInstance,
  ERC20Instance,
  FixedLeverageRatioStrategyInstance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
  ZapperInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {
  createPoolWithCreditLine,
  expectOwnerRole,
  expectProxyOwner,
  mochaEach,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {StakedPositionType} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {Contract} from "ethers/lib/ethers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const go = await getTruffleContract<GoInstance>("Go")
  const gfi = await getTruffleContract<GFIInstance>("GFI")
  const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards")
  const goldfinchConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig")
  const backerRewards = await getTruffleContract<BackerRewardsInstance>("BackerRewards")
  const seniorPool = await getTruffleContract<SeniorPoolInstance>("SeniorPool")
  const stakingRewards = await getTruffleContract<StakingRewardsInstance>("StakingRewards")
  const uniqueIdentity = await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity")
  const goldfinchFactory = await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory")
  const fixedLeverageRatioStrategy = await getTruffleContract<FixedLeverageRatioStrategyInstance>(
    "FixedLeverageRatioStrategy"
  )

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
    stakingRewards,
    go,
    uniqueIdentity,
    goldfinchFactory,
    fixedLeverageRatioStrategy,
  }
})

describe("v2.6.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let gfi: GFIInstance
  let goldfinchConfig: GoldfinchConfigInstance
  let backerRewards: BackerRewardsInstance
  let seniorPool: SeniorPoolInstance
  let go: GoInstance
  let stakingRewards: StakingRewardsInstance
  let uniqueIdentity: UniqueIdentityInstance
  let goldfinchFactory: GoldfinchFactoryInstance

  let tranchedPoolImplAddressBeforeDeploy: string
  let leverageRatioStrategyAddressBeforeDeploy: string

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({gfi, goldfinchConfig, backerRewards, seniorPool, go, stakingRewards, uniqueIdentity, goldfinchFactory} =
      await setupTest())

    tranchedPoolImplAddressBeforeDeploy = await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)
    leverageRatioStrategyAddressBeforeDeploy = await goldfinchConfig.getAddress(CONFIG_KEYS.LeverageRatio)
  })

  describe("after deploy", async () => {
    let params
    let zapper: ZapperInstance
    let fixedLeverageRatioStrategy: FixedLeverageRatioStrategyInstance
    let tranchedPoolDeployment: Contract
    const setupTest = deployments.createFixture(async () => {
      await migrate250.main()
      const {params, deployedContracts} = await migrate260.main()
      const zapper = await getTruffleContract<ZapperInstance>("Zapper")
      const fixedLeverageRatioStrategy = await getTruffleContract<FixedLeverageRatioStrategyInstance>(
        "FixedLeverageRatioStrategy"
      )
      return {zapper, fixedLeverageRatioStrategy, params, deployedContracts}
    })

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({
        params,
        zapper,
        fixedLeverageRatioStrategy,
        deployedContracts: {tranchedPool: tranchedPoolDeployment},
      } = await setupTest())
    })

    describe("UniqueIdentity", async () => {
      describe("supportedUIDType", async () => {
        mochaEach([0, 1, 2, 3, 4]).it("is true for type = %d", async (type: number) => {
          expect(await uniqueIdentity.supportedUIDTypes(type)).to.equal(true)
        })
      })
    })

    describe("GoldfinchConfig", async () => {
      describe("getAddress", async () => {
        describe("TranchedPool", async () => {
          it("is upgraded address", async () => {
            const configAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)
            expect(configAddress).to.not.eq(tranchedPoolImplAddressBeforeDeploy)
            expect(configAddress).to.eq(tranchedPoolDeployment.address)
          })
        })

        describe("SeniorPoolStrategy", async () => {
          it("is correct", async () => {
            const addressInConfig = await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)
            expect(addressInConfig).to.not.eq(leverageRatioStrategyAddressBeforeDeploy)
            expect(addressInConfig).to.eq(fixedLeverageRatioStrategy.address)
          })
        })

        describe("FiduUSDCCurveLP", async () => {
          it("is correct", async () => {
            const configAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.FiduUSDCCurveLP)
            expect(configAddress).to.be.eq(MAINNET_FIDU_USDC_CURVE_LP_ADDRESS)
          })
        })
      })
    })

    describe("Go", async () => {
      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("is true for Zapper contract", async () => {
            expect(await go.hasRole(await go.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })
    })

    describe("Zapper", async () => {
      expectProxyOwner({
        toBe: getProtocolOwner,
        forContracts: ["Zapper"],
      })

      expectOwnerRole({toBe: getProtocolOwner, forContracts: ["Zapper"]})
    })

    describe("GFI", async () => {
      describe("balanceOf", async () => {
        describe("BackerRewards", async () => {
          it("is correct", async () => {
            expect((await gfi.balanceOf(backerRewards.address)).toString()).to.bignumber.eq(
              params.BackerRewards.totalRewards
            )
          })
        })
      })
    })

    describe("FixedLeverageRatioStrategy", async () => {
      expectOwnerRole({
        toBe: getProtocolOwner,
        forContracts: ["FixedLeverageRatioStrategy"],
      })
    })

    describe("BackerRewards", async () => {
      describe("maxInterestDollarsElligible", async () => {
        it("is correct", async () => {
          expect(await backerRewards.maxInterestDollarsEligible()).to.bignumber.eq(
            params.BackerRewards.maxInterestDollarsEligible
          )
        })
      })

      describe("totalRewardPercentOfTotalGFI", async () => {
        it("is correct", async () => {
          // This function returns percentage points as the base unit. meaning that 1e18 = 1 percent
          const two = "2000000000000000000"
          expect((await backerRewards.totalRewardPercentOfTotalGFI()).toString()).to.eq(two)
        })
      })
    })

    context("Go", () => {
      expectProxyOwner({
        toBe: getProtocolOwner,
        forContracts: ["Go"],
      })

      expectOwnerRole({
        toBe: async () => getProtocolOwner(),
        forContracts: ["Go"],
      })

      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("Zapper to be true", async () => {
            expect(await go.hasRole(await go.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })

      context("getSeniorPoolIdTypes", () => {
        it("getSeniorPoolIdTypes", async () => {
          const received = await go.getSeniorPoolIdTypes()
          expect(received).deep.equal([
            await go.ID_TYPE_0(),
            await go.ID_TYPE_1(),
            await go.ID_TYPE_3(),
            await go.ID_TYPE_4(),
          ])
        })
      })
    })

    describe("TranchedPool", async () => {
      let tranchedPool: TranchedPoolInstance
      const allowedUIDTypes = [0, 1, 2, 3, 4]

      const testSetup = deployments.createFixture(async () => {
        const [, , , , , maybeBorrower] = await hre.getUnnamedAccounts()
        const borrower = asNonNullable(maybeBorrower)
        const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)})
        const {tranchedPool} = await createPoolWithCreditLine({
          people: {borrower, owner: await getProtocolOwner()},
          usdc,
          goldfinchFactory,
          allowedUIDTypes,
        })

        return {tranchedPool}
      })

      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({tranchedPool} = await testSetup())
      })

      describe("getAllowedUIDTypes", async () => {
        it("is correct", async () => {
          const sampledUidTypes = (await tranchedPool.getAllowedUIDTypes()).map((x) => x.toNumber())
          expect(sampledUidTypes).to.deep.eq(allowedUIDTypes)
        })
      })
    })

    describe("SeniorPool", async () => {
      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("is true for Zapper contract", async () => {
            expect(await seniorPool.hasRole(await seniorPool.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })
    })

    describe("StakingRewards", async () => {
      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("is true for Zapper contract", async () => {
            expect(await stakingRewards.hasRole(await stakingRewards.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })

      describe("effectiveMultiplier", async () => {
        describe("CurveLp", async () => {
          it("is correct", async () => {
            expect(params.StakingRewards.effectiveMultiplier).to.eq("750000000000000000")
            expect((await stakingRewards.getEffectiveMultiplier(StakedPositionType.CurveLP)).toString()).to.eq(
              params.StakingRewards.effectiveMultiplier
            )
          })
        })
      })
    })
  })
})

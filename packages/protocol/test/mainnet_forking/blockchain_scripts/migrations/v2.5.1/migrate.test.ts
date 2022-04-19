import hre, {deployments, getNamedAccounts} from "hardhat"
import {asNonNullable, assertIsString} from "packages/utils/src/type"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
  PAUSER_ROLE,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import * as migrate251 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5.1/migrate"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  BackerRewardsInstance,
  CommunityRewardsInstance,
  ERC20Instance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  UniqueIdentityInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {expectOwnerRole, mochaEach} from "@goldfinch-eng/protocol/test/testHelpers"
import {Suite} from "mocha"

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
  const poolTokens = await getTruffleContract<PoolTokensInstance>("PoolTokens")
  const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {
    gfi,
    usdc,
    goldfinchConfig,
    communityRewards,
    backerRewards,
    seniorPool,
    stakingRewards,
    go,
    uniqueIdentity,
    goldfinchFactory,
    poolTokens,
  }
})

const pauser = migrate251.EMERGENCY_PAUSER_ADDR

describe("v2.5.1", async function () {
  this.timeout(TEST_TIMEOUT)

  let backerRewards: BackerRewardsInstance
  let go: GoInstance
  let uniqueIdentity: UniqueIdentityInstance
  let goldfinchFactory: GoldfinchFactoryInstance
  let poolTokens: PoolTokensInstance
  let communityRewards: CommunityRewardsInstance
  let stakingRewards: StakingRewardsInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({backerRewards, go, uniqueIdentity, goldfinchFactory, poolTokens, communityRewards, stakingRewards} =
      await setupTest())
  })

  describe("after deploy", async () => {
    const setupTest = deployments.createFixture(async () => {
      await migrate251.main()
    })

    beforeEach(async () => {
      await setupTest()
    })

    describe("PoolTokens", () => {
      it(`'${pauser}' can pause`, async () => {
        await impersonateAccount(hre, pauser)
        await expect(poolTokens.pause()).to.be.fulfilled
        expect(await poolTokens.paused()).to.be.true
      })

      it(`'${pauser}' has the PAUSER_ROLE`, async () => {
        expect(await poolTokens.hasRole(PAUSER_ROLE, pauser)).to.be.true
      })
    })

    describe("GoldfinchFactory", () => {
      it(`'${pauser}' can pause`, async () => {
        await impersonateAccount(hre, pauser)
        await expect(goldfinchFactory.pause({from: pauser})).to.be.fulfilled
        expect(await goldfinchFactory.paused()).to.be.true
      })

      it(`'${pauser}' has the PAUSER_ROLE`, async () => {
        expect(await goldfinchFactory.hasRole(PAUSER_ROLE, pauser)).to.be.true
      })
    })

    describe("UniqueIdentity", () => {
      it(`'${pauser}' can pause`, async () => {
        await impersonateAccount(hre, pauser)
        await expect(uniqueIdentity.pause({from: pauser})).to.be.fulfilled
        expect(await uniqueIdentity.paused()).to.be.true
      })

      it(`'${migrate251.EMERGENCY_PAUSER_ADDR}' has the PAUSER_ROLE`, async () => {
        expect(await uniqueIdentity.hasRole(PAUSER_ROLE, pauser)).to.be.true
      })
    })

    describe("BackerRewards", () => {
      it(`'${migrate251.EMERGENCY_PAUSER_ADDR}' can pause`, async () => {
        await impersonateAccount(hre, pauser)
        await expect(backerRewards.pause({from: pauser})).to.be.fulfilled
        expect(await backerRewards.paused()).to.be.true
      })

      it(`'${migrate251.EMERGENCY_PAUSER_ADDR}' has the PAUSER_ROLE`, async () => {
        expect(await backerRewards.hasRole(PAUSER_ROLE, pauser)).to.be.true
      })
    })

    describe("StakingRewards", () => {
      it(`'${pauser}' can pause`, async () => {
        await impersonateAccount(hre, pauser)
        await expect(stakingRewards.pause({from: pauser})).to.be.fulfilled
        expect(await stakingRewards.paused()).to.be.true
      })

      it(`'${pauser}' has the PAUSER_ROLE`, async () => {
        expect(await stakingRewards.hasRole(PAUSER_ROLE, pauser)).to.be.true
      })
    })

    describe("Go", () => {
      it(`'${pauser}' can pause`, async () => {
        await impersonateAccount(hre, pauser)
        await expect(go.pause({from: pauser})).to.be.fulfilled
        expect(await go.paused()).to.be.true
      })

      it(`'${pauser}' has the PAUSER_ROLE`, async () => {
        expect(await go.hasRole(PAUSER_ROLE, pauser)).to.be.true
      })
    })

    describe("CommunityRewards", () => {
      it(`'${pauser}' can pause`, async () => {
        await impersonateAccount(hre, pauser)
        await expect(communityRewards.pause({from: pauser})).to.be.fulfilled
        expect(await communityRewards.paused()).to.be.true
      })

      it(`'${pauser}' has the PAUSER_ROLE`, async () => {
        expect(await communityRewards.hasRole(PAUSER_ROLE, pauser)).to.be.true
      })
    })
  })
})

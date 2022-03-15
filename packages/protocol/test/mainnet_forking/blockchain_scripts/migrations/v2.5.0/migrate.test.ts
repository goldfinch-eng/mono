import hre, {deployments, getNamedAccounts} from "hardhat"
import {asNonNullable, assertIsString} from "packages/utils/src/type"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import * as migrate250 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5.0/migrate"
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
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {
  BN,
  createPoolWithCreditLine,
  expectOwnerRole,
  expectProxyOwner,
  mochaEach,
} from "@goldfinch-eng/protocol/test/testHelpers"

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
  }
})

describe("v2.5.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let backerRewards: BackerRewardsInstance
  let go: GoInstance
  let uniqueIdentity: UniqueIdentityInstance
  let goldfinchFactory: GoldfinchFactoryInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({backerRewards, go, uniqueIdentity, goldfinchFactory} = await setupTest())
  })

  describe("after deploy", async () => {
    let params
    const setupTest = deployments.createFixture(async () => {
      const {params} = await migrate250.main()
      return {params}
    })

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({params} = await setupTest())
    })

    describe("UniqueIdentity", async () => {
      describe("supportedUIDType", async () => {
        mochaEach([0, 1, 2, 3, 4]).it("is true for type = %d", async (type: number) => {
          expect(await uniqueIdentity.supportedUIDTypes(type)).to.equal(true)
        })
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

      describe("allowedUidTypes", () => {
        mochaEach(allowedUIDTypes).it("id type %d is allowed", async (uidType: number) => {
          const sampled = await tranchedPool.allowedUIDTypes(uidType)
          expect(sampled).to.bignumber.eq(new BN(uidType))
        })
      })
    })
  })
})

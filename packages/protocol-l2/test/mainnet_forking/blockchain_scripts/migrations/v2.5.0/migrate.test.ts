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
  CreditLineInstance,
  ERC20Instance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {
  advanceTime,
  BN,
  createPoolWithCreditLine,
  expectOwnerRole,
  expectProxyOwner,
  getTruffleContractAtAddress,
  mochaEach,
} from "@goldfinch-eng/protocol/test/testHelpers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("baseDeploy", {keepExistingDeployments: true})

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

export const almaPool6Info = {
  address: "0x418749e294cabce5a714efccc22a8aade6f9db57",
  aPoolToken: {
    // Cf. https://etherscan.io/token/0x57686612c601cb5213b01aa8e80afeb24bbd01df?a=512
    ownerAddress: "0xf21a3d0146b0ceb7cb45ba7543c3ca3525a8830d",
    id: "512",
  },
}

describe.skip("v2.5.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let backerRewards: BackerRewardsInstance
  let go: GoInstance
  let uniqueIdentity: UniqueIdentityInstance
  let goldfinchFactory: GoldfinchFactoryInstance
  let gfi: GFIInstance
  let poolTokens: PoolTokensInstance
  let usdc: ERC20Instance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({backerRewards, go, uniqueIdentity, goldfinchFactory, gfi, poolTokens, usdc} = await setupTest())
  })

  describe("after deploy", async () => {
    let params: migrate250.Migration250Params
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
      describe("GFI balance", () => {
        it("should be 0", async () => {
          const gfiBalance = await gfi.balanceOf(backerRewards.address)
          expect(gfiBalance).to.bignumber.equal(new BN(0))
        })
      })

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

      describe("withdraw", () => {
        const tokenInfo = almaPool6Info.aPoolToken

        context("before interest repayment", function () {
          beforeEach(async () => {
            await impersonateAccount(hre, tokenInfo.ownerAddress)
            await fundWithWhales(["ETH"], [tokenInfo.ownerAddress])
            const info = await poolTokens.tokens(tokenInfo.id)
            const principalAmount = info[2]
            expect(principalAmount.gt(new BN(0))).to.be.true
          })

          it('allows "withdrawing" 0', async () => {
            const claimableRewards = await backerRewards.poolTokenClaimableRewards(tokenInfo.id)
            expect(claimableRewards).to.bignumber.equal(new BN(0))
            const withdrawal = backerRewards.withdraw(tokenInfo.id, {
              from: tokenInfo.ownerAddress,
            })
            await expect(withdrawal).to.be.fulfilled
          })
        })
        context("after interest repayment", function () {
          beforeEach(async () => {
            await impersonateAccount(hre, tokenInfo.ownerAddress)
            await fundWithWhales(["ETH"], [tokenInfo.ownerAddress])

            const owner = await getProtocolOwner()
            await fundWithWhales(["USDC"], [owner])

            await advanceTime({days: "30"})

            const tranchedPool = await getTruffleContractAtAddress<TranchedPoolInstance>(
              "TranchedPool",
              almaPool6Info.address
            )
            await tranchedPool.assess()
            const creditLine = await getTruffleContractAtAddress<CreditLineInstance>(
              "CreditLine",
              await tranchedPool.creditLine()
            )
            const interestOwedBefore = await creditLine.interestOwed()
            expect(interestOwedBefore.gt(new BN(0))).to.be.true

            await usdc.approve(tranchedPool.address, interestOwedBefore, {from: owner})
            await tranchedPool.methods["pay(uint256)"](interestOwedBefore.toString(), {from: owner})

            const interestOwedAfter = await creditLine.interestOwed()
            expect(interestOwedAfter).to.bignumber.equal(new BN(0))
          })

          it("rejects withdrawing non-zero amount, due to insufficient GFI", async () => {
            const claimableRewards = await backerRewards.poolTokenClaimableRewards(tokenInfo.id)
            expect(claimableRewards).to.bignumber.equal(new BN("3014668121250461200"))
            const withdrawal = backerRewards.withdraw(tokenInfo.id, {
              from: tokenInfo.ownerAddress,
            })
            await expect(withdrawal).to.be.rejectedWith(/ERC20: transfer amount exceeds balance/)
          })
        })
      })
    })

    context("CommunityRewards", () => {
      expectProxyOwner({
        toBe: getProtocolOwner,
        forContracts: ["CommunityRewards"],
      })

      expectOwnerRole({
        toBe: async () => getProtocolOwner(),
        forContracts: ["CommunityRewards"],
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

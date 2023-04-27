import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import hre, {deployments, ethers, getChainId} from "hardhat"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
} from "packages/protocol/blockchain_scripts/deployHelpers"

import {
  ERC20Instance,
  StakingRewardsInstance,
  BackerRewardsInstance,
  PoolTokensInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"

import * as migrate331 from "../../../../../blockchain_scripts/migrations/v3.3.1/migrate3_3_1"
import BN from "bn.js"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"

describe("v3.3.1", async function () {
  let stakingRewards: StakingRewardsInstance
  let backerRewards: BackerRewardsInstance
  let gfi: ERC20Instance
  let poolTokens: PoolTokensInstance

  // GFI balances before
  let stakingRewardsGfiBalanceBefore: BN
  let backerRewardsGfiBalanceBefore: BN
  let governanceGfiBalanceBefore: BN

  let backerRewardsTotalRewardsBefore: BN

  const setupTest = deployments.createFixture(async () => {
    await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

    await fundWithWhales(["USDC"], [await getProtocolOwner()])
    const protocolOwner = await getProtocolOwner()
    const gfi = await getTruffleContract<ERC20Instance>("GFI")
    const backerRewards = await getTruffleContract<BackerRewardsInstance>("BackerRewards")
    const stakingRewards = await getTruffleContract<StakingRewardsInstance>("StakingRewards")

    backerRewardsGfiBalanceBefore = await gfi.balanceOf(backerRewards.address)
    stakingRewardsGfiBalanceBefore = await gfi.balanceOf(stakingRewards.address)
    governanceGfiBalanceBefore = await gfi.balanceOf(protocolOwner)

    backerRewardsTotalRewardsBefore = await backerRewards.totalRewards()

    return {
      stakingRewards,
      usdc: await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)}),
      gfi,
      backerRewards,
      poolTokens: await getTruffleContract<PoolTokensInstance>("PoolTokens"),
    }
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({stakingRewards, backerRewards, gfi, poolTokens} = await setupTest())
  })

  describe("after migration", async () => {
    const setup = deployments.createFixture(async () => {
      const {newTotalRewardsParam} = await migrate331.main()
      totalRewards = new BN(newTotalRewardsParam.toString())
    })

    let totalRewards: BN

    beforeEach(async () => {
      await setup()
    })

    describe("StakingRewards", () => {
      it("GFI balance decreased the expected amount", async () => {
        const gfiBalance = await gfi.balanceOf(stakingRewards.address)

        expect(gfiBalance).to.bignumber.lt(stakingRewardsGfiBalanceBefore)
        expect(gfiBalance).to.bignumber.eq(
          stakingRewardsGfiBalanceBefore.sub(migrate331.rewardsToRemoveFromStakingRewards)
        )
      })
    })

    describe("ProtocolOwner", async () => {
      it("should have the same GFI balance", async () => {
        // Because governance is sweeping rewards and then immediately transferring the rewards it should have
        // the same GFI balance as before.
        expect(await gfi.balanceOf(await getProtocolOwner())).to.bignumber.eq(governanceGfiBalanceBefore)
      })
    })

    describe("BackerRewards", async () => {
      it("GFI balance increased the expected amount", async () => {
        const gfiBalance = await gfi.balanceOf(backerRewards.address)
        expect(gfiBalance).to.bignumber.gt(backerRewardsGfiBalanceBefore)
        expect(gfiBalance).to.bignumber.eq(
          backerRewardsGfiBalanceBefore.add(migrate331.rewardsToRemoveFromStakingRewards)
        )
      })

      it("maxInterestDollarsElligible is correct", async () => {
        expect(await backerRewards.maxInterestDollarsEligible()).to.bignumber.eq(migrate331.maxInterestDollarsEllibile)
      })

      it("totalRewards parameter is correct", async () => {
        const newTotalRewards = await backerRewards.totalRewards()

        expect(newTotalRewards).to.bignumber.gt(backerRewardsTotalRewardsBefore)
        expect(newTotalRewards).to.bignumber.eq(totalRewards)
      })

      // This test takes a very long time to run because it needs to query the balance
      // of every single pool token in existence.
      it("allocates all rewards after max interest has been received", async () => {
        const alma6Address = "0x418749e294cabce5a714efccc22a8aade6f9db57"

        const maxInterestDollarsEligible = await backerRewards.maxInterestDollarsEligible()
        const interestReceived = await backerRewards.totalInterestReceived()
        const remainingInterest = maxInterestDollarsEligible.sub(interestReceived)

        const maxTokenId = await poolTokens._tokenIdTracker()

        await impersonateAccount(hre, alma6Address)
        await ethers.provider.send("hardhat_setBalance", [alma6Address, ethers.utils.parseEther("10.0").toHexString()])
        // This simulates an interest payment more than all of the remaining interest eligibile for rewards.
        // If we incorrectly set the total rewards available parameter then the rewardsWithdrawable would be
        // greater than the GFI balance of the contract
        await backerRewards.allocateRewards(remainingInterest, {from: alma6Address})

        let rewardsWithdrawable = new BN(0)
        for (let i = 1; i < maxTokenId.toNumber(); i++) {
          const stakingRewards = await backerRewards.stakingRewardsEarnedSinceLastWithdraw(i)
          const interestRewards = await backerRewards.poolTokenClaimableRewards(i)
          rewardsWithdrawable = rewardsWithdrawable.add(stakingRewards).add(interestRewards)
        }

        const backerRewardsGfiBalance = await gfi.balanceOf(backerRewards.address)
        expect(rewardsWithdrawable).to.bignumber.lte(backerRewardsGfiBalance)
      }).timeout(1_000 * 60 * 10) // 10 minutes

      // This test takes a very long time to run because it needs to query the balance
      // of every single pool token in existence.
      it("allocates all rewards after twice max interest has been received", async () => {
        const alma6Address = "0x418749e294cabce5a714efccc22a8aade6f9db57"

        const maxInterestDollarsEligible = await backerRewards.maxInterestDollarsEligible()
        const interestReceived = await backerRewards.totalInterestReceived()
        const remainingInterest = maxInterestDollarsEligible.sub(interestReceived)

        const maxTokenId = await poolTokens._tokenIdTracker()

        await impersonateAccount(hre, alma6Address)
        await ethers.provider.send("hardhat_setBalance", [alma6Address, ethers.utils.parseEther("10.0").toHexString()])
        // This simulates an interest payment more than all of the remaining interest eligibile for rewards.
        // If we incorrectly set the total rewards available parameter then the rewards withdrawable would be
        // greater than the GFI balance of the contract
        await backerRewards.allocateRewards(remainingInterest.mul(new BN("2")), {from: alma6Address})

        let rewardsWithdrawable = new BN(0)
        for (let i = 1; i < maxTokenId.toNumber(); i++) {
          const stakingRewards = await backerRewards.stakingRewardsEarnedSinceLastWithdraw(i)
          const interestRewards = await backerRewards.poolTokenClaimableRewards(i)
          rewardsWithdrawable = rewardsWithdrawable.add(stakingRewards).add(interestRewards)
        }

        const backerRewardsGfiBalance = await gfi.balanceOf(backerRewards.address)
        expect(rewardsWithdrawable).to.bignumber.lte(backerRewardsGfiBalance)
      }).timeout(1_000 * 60 * 10) // 10 minutes
    })
  })
})

import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {deployments} from "hardhat"
import {getProtocolOwner, getTruffleContract} from "packages/protocol/blockchain_scripts/deployHelpers"

import {ERC20Instance, StakingRewardsInstance, BackerRewardsInstance} from "@goldfinch-eng/protocol/typechain/truffle"

import * as migrate322 from "../../../../../blockchain_scripts/migrations/v3.2.2/migrate3_2_2"
import BN from "bn.js"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  await fundWithWhales(["USDC"], [await getProtocolOwner()])
  await fundWithWhales(["GFI"], [await getProtocolOwner()])

  // return {
  //   membershipOrchestrator: await getTruffleContract<any>("MembershipOrchestrator"),
  //   usdc: await getTruffleContract<any>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)}),
  // }

  return {
    stakingRewards: await getTruffleContract<StakingRewardsInstance>("StakingRewards"),
    gfi: await getTruffleContract<ERC20Instance>("GFI"),
    backerRewards: await getTruffleContract<BackerRewardsInstance>("BackerRewards"),
  }
})

describe("v3.1.2", async function () {
  let stakingRewards: StakingRewardsInstance
  let backerRewards: BackerRewardsInstance
  let gfi: ERC20Instance

  // GFI balances before
  let stakingRewardsGfiBalanceBefore: BN
  let backerRewardsGfiBalanceBefore: BN

  let backerRewardsTotalRewardsBefore: BN
  let backerRewardsMaxInterestDollarsElligibleBefore: BN

  // StakingRewards rewards params
  let stakingRewardsTargetCapacityBefore: BN
  let stakingRewardsMinRateBefore: BN
  let stakingRewardsMaxRateBefore: BN
  let stakingRewardsMinRateAtPercentBefore: BN
  let stakingRewardsMaxRateAtPercentBefore: BN

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({stakingRewards, backerRewards, gfi} = await setupTest())

    backerRewardsGfiBalanceBefore = await gfi.balanceOf(backerRewards.address)
    stakingRewardsGfiBalanceBefore = await gfi.balanceOf(stakingRewards.address)

    backerRewardsTotalRewardsBefore = await backerRewards.totalRewards()
    backerRewardsMaxInterestDollarsElligibleBefore = await backerRewards.maxInterestDollarsEligible()

    stakingRewardsTargetCapacityBefore = await stakingRewards.targetCapacity()
    stakingRewardsMinRateBefore = await stakingRewards.minRate()
    stakingRewardsMaxRateBefore = await stakingRewards.maxRate()
    stakingRewardsMinRateAtPercentBefore = await stakingRewards.minRateAtPercent()
    stakingRewardsMaxRateAtPercentBefore = await stakingRewards.maxRateAtPercent()
  })

  describe("after migration", async () => {
    const setup = deployments.createFixture(async () => {
      return await migrate322.main()
    })

    let totalRewards: BN

    beforeEach(async () => {
      const {newTotalRewardsParam} = await setup()
      totalRewards = new BN(newTotalRewardsParam.toString())
      console.log(totalRewards.toString())
    })

    describe("StakingRewards", () => {
      it("GFI balance decreased the expected amount", async () => {
        const gfiBalance = await gfi.balanceOf(stakingRewards.address)

        expect(gfiBalance).to.bignumber.lt(stakingRewardsGfiBalanceBefore)
        expect(gfiBalance).to.bignumber.eq(
          stakingRewardsGfiBalanceBefore.sub(migrate322.rewardsToRemoveFromStakingRewards)
        )
      })

      it("targetCapacity is the same", async () => {
        expect(await stakingRewards.targetCapacity()).to.be.bignumber.eq(stakingRewardsTargetCapacityBefore)
      })

      it("minRate is the same", async () => {
        expect(await stakingRewards.minRate()).to.be.bignumber.eq(stakingRewardsMinRateBefore)
      })

      it("maxRate is 40% of previous value", async () => {
        expect(await stakingRewards.maxRate()).to.bignumber.eq(
          stakingRewardsMaxRateBefore.mul(new BN(2)).div(new BN(5))
        )
      })

      it("minRateAtPercent is the same", async () => {
        expect(await stakingRewards.minRateAtPercent()).to.be.bignumber.eq(stakingRewardsMinRateAtPercentBefore)
      })

      it("maxRateAtPercent is the same", async () => {
        expect(await stakingRewards.maxRateAtPercent()).to.be.bignumber.eq(stakingRewardsMaxRateAtPercentBefore)
      })
    })

    describe("BackerRewards", async () => {
      it("GFI balance increased the expected amount", async () => {
        const gfiBalance = await gfi.balanceOf(backerRewards.address)
        expect(gfiBalance).to.bignumber.gt(backerRewardsGfiBalanceBefore)
        expect(gfiBalance).to.bignumber.eq(
          backerRewardsGfiBalanceBefore.add(migrate322.rewardsToRemoveFromStakingRewards)
        )
      })

      it("maxInterestDollarsElligible is correct", async () => {
        expect(await backerRewards.maxInterestDollarsEligible()).to.bignumber.eq(migrate322.maxInterestDollarsEllibile)
      })

      it("totalRewards parameter is correct", async () => {
        const newTotalRewards = await backerRewards.totalRewards()

        expect(newTotalRewards).to.bignumber.gt(backerRewardsTotalRewardsBefore)
        expect(newTotalRewards).to.bignumber.eq(totalRewards)
      })
    })
  })
})

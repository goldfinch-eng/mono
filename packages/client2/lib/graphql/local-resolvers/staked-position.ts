import { Resolvers } from "@apollo/client";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { SeniorPoolStakedPosition } from "../generated";

export const stakedPositionResolvers: Resolvers[string] = {
  async rewardEarnRate(
    position: SeniorPoolStakedPosition
  ): Promise<SeniorPoolStakedPosition["rewardEarnRate"]> {
    const stakingRewardsContract = await getStakingRewardsContract();
    return stakingRewardsContract.positionCurrentEarnRate(position.id);
  },

  async claimable(
    position: SeniorPoolStakedPosition
  ): Promise<SeniorPoolStakedPosition["claimable"]> {
    const provider = await getProvider();
    if (!provider) {
      throw new Error("No provider when getting StakingRewards contract");
    }
    const chainId = await provider.getSigner().getChainId();
    const stakingRewardsContract = getContract({
      name: "StakingRewards",
      chainId,
      provider,
    });
    const positionDetails = await stakingRewardsContract.positions(position.id);
    const rewards = positionDetails.rewards;
    const optimisticClaimable =
      await stakingRewardsContract.optimisticClaimable(position.id);
    const timestamp = (await provider.getBlock("latest")).timestamp;
    return (
      await stakingRewardsContract.totalVestedAt(
        rewards.startTime,
        rewards.endTime,
        timestamp,
        optimisticClaimable.add(rewards.totalVested).add(rewards.totalUnvested)
      )
    ).sub(rewards.totalClaimed);
  },

  async granted(
    position: SeniorPoolStakedPosition
  ): Promise<SeniorPoolStakedPosition["granted"]> {
    const stakingRewardsContract = await getStakingRewardsContract();
    const positionDetails = await stakingRewardsContract.positions(position.id);
    const rewards = positionDetails.rewards;
    const earnedSinceLastCheckpoint =
      await stakingRewardsContract.earnedSinceLastCheckpoint(position.id);

    return rewards.totalUnvested
      .add(rewards.totalVested)
      .add(rewards.totalPreviouslyVested)
      .add(earnedSinceLastCheckpoint);
  },

  async endTime(
    position: SeniorPoolStakedPosition
  ): Promise<SeniorPoolStakedPosition["endTime"]> {
    const stakingRewardsContract = await getStakingRewardsContract();
    return (await stakingRewardsContract.positions(position.id)).rewards
      .endTime;
  },
};

// just for convenience in this file
async function getStakingRewardsContract() {
  const provider = await getProvider();
  if (!provider) {
    throw new Error("No provider when getting StakingRewards contract");
  }
  const chainId = await provider.getSigner().getChainId();
  const stakingRewardsContract = getContract({
    name: "StakingRewards",
    chainId,
    provider,
  });

  return stakingRewardsContract;
}

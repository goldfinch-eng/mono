import { Resolvers } from "@apollo/client";
import { getProvider } from "@wagmi/core";

import { getContract } from "@/lib/contracts";

import { SeniorPoolStakedPosition } from "../generated";

export const stakedPositionResolvers: Resolvers[string] = {
  async rewardEarnRate(
    position: SeniorPoolStakedPosition
  ): Promise<SeniorPoolStakedPosition["rewardEarnRate"]> {
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
    });
    return stakingRewardsContract.positionCurrentEarnRate(position.id);
  },

  // This logic is largely the same as client/src/ethereum/pool.ts (line 894, claimable())
  // Calling optimisticClaimable() on the smart contract isn't accurate, unfortunately
  async claimable(
    position: SeniorPoolStakedPosition
  ): Promise<SeniorPoolStakedPosition["claimable"]> {
    const provider = getProvider();
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
    });

    const currentBlock = await provider.getBlock("latest");
    const earnedSinceLastCheckpoint =
      await stakingRewardsContract.earnedSinceLastCheckpoint(position.id);
    const positionDetails = await stakingRewardsContract.positions(position.id);
    const rewards = positionDetails.rewards;
    const optimisticCurrentGrant = rewards.totalUnvested
      .add(rewards.totalVested)
      .add(earnedSinceLastCheckpoint);
    const optimisticTotalVested = await stakingRewardsContract.totalVestedAt(
      rewards.startTime,
      rewards.endTime,
      currentBlock.timestamp,
      optimisticCurrentGrant
    );

    return optimisticTotalVested
      .add(rewards.totalPreviouslyVested)
      .sub(rewards.totalClaimed);
  },

  async granted(
    position: SeniorPoolStakedPosition
  ): Promise<SeniorPoolStakedPosition["granted"]> {
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
    });
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
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
    });
    return (await stakingRewardsContract.positions(position.id)).rewards
      .endTime;
  },
};

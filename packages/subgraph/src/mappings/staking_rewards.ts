import {RewardAdded, Staked, Unstaked} from "../../generated/templates/StakingRewards/StakingRewards"

import {updateCurrentEarnRate} from "../entities/staking_rewards"

export function handleRewardAdded(event: RewardAdded): void {
  updateCurrentEarnRate()
}

export function handleStaked(event: Staked): void {
  updateCurrentEarnRate()
}

export function handleUnstaked(event: Unstaked): void {
  updateCurrentEarnRate()
}

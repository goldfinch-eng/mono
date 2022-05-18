import {RewardAdded, Staked, Unstaked} from "../../generated/templates/StakingRewards/StakingRewards"

import {updateCurrentEarnRate} from "../entities/staking_rewards"
import {updateStakedSeniorPoolBalance} from "../entities/user"

export function handleRewardAdded(event: RewardAdded): void {
  updateCurrentEarnRate(event.address)
}

export function handleStaked(event: Staked): void {
  updateCurrentEarnRate(event.address)
  updateStakedSeniorPoolBalance(event.params.user, event.params.amount)
}

export function handleUnstaked(event: Unstaked): void {
  updateCurrentEarnRate(event.address)
  updateStakedSeniorPoolBalance(event.params.user, event.params.amount.neg())
}

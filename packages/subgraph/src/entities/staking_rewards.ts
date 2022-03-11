import {Address} from "@graphprotocol/graph-ts"

import {StakingRewards} from "../../generated/schema"
import {StakingRewards_Implementation as StakingRewardsContract} from "../../generated/templates/StakingRewards/StakingRewards_Implementation"

import {STAKING_REWARDS_ADDRESS} from "../constants"

const STAKING_REWARDS_ID = "1"

function getStakingRewards(): StakingRewards {
  let stakingRewards = StakingRewards.load(STAKING_REWARDS_ID)
  if (!stakingRewards) {
    stakingRewards = new StakingRewards(STAKING_REWARDS_ID)
  }
  return stakingRewards
}

export function updateCurrentEarnRate(): void {
  const contract = StakingRewardsContract.bind(Address.fromString(STAKING_REWARDS_ADDRESS))
  const callResult = contract.try_currentEarnRatePerToken()
  if (!callResult.reverted) {
    const stakingRewards = getStakingRewards()
    stakingRewards.currentEarnRatePerToken = callResult.value
    stakingRewards.save()
  }
}

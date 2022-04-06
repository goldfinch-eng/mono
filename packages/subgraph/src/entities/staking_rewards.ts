import {Address} from "@graphprotocol/graph-ts"

import {StakingRewards} from "../../generated/schema"
import {StakingRewards_Implementation as StakingRewardsContract} from "../../generated/templates/StakingRewards/StakingRewards_Implementation"

import {updateEstimatedApyFromGfiRaw} from "./senior_pool"
import {updateGfiData} from "./gfi"

const STAKING_REWARDS_ID = "1"

export function getStakingRewards(): StakingRewards {
  let stakingRewards = StakingRewards.load(STAKING_REWARDS_ID)
  if (!stakingRewards) {
    stakingRewards = new StakingRewards(STAKING_REWARDS_ID)
  }
  return stakingRewards
}

export function updateCurrentEarnRate(contractAddress: Address): void {
  const contract = StakingRewardsContract.bind(contractAddress)
  const callResult = contract.try_currentEarnRatePerToken()
  if (!callResult.reverted) {
    const stakingRewards = getStakingRewards()
    stakingRewards.currentEarnRatePerToken = callResult.value

    // ! This is a weird place to update GFI data, but as it turns out it's really hard to place a call to gfi.totalSupply() because that has to be done after minting and Call Handlers aren't supported by hardhat
    updateGfiData(contract.rewardsToken())

    stakingRewards.save()
    updateEstimatedApyFromGfiRaw()
  }
  contract.rewardsToken
}

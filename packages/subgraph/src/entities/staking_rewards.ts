import {Address, BigInt} from "@graphprotocol/graph-ts"

import {StakingRewardsData} from "../../generated/schema"
import {StakingRewards as StakingRewardsContract} from "../../generated/StakingRewards/StakingRewards"
import {getOrInitSeniorPool, calculateEstimatedApyFromGfiRaw} from "../mappings/senior_pool/helpers"

const STAKING_REWARDS_ID = "1"

export function getStakingRewards(): StakingRewardsData {
  let stakingRewards = StakingRewardsData.load(STAKING_REWARDS_ID)
  if (!stakingRewards) {
    stakingRewards = new StakingRewardsData(STAKING_REWARDS_ID)
    stakingRewards.currentEarnRatePerToken = BigInt.zero()
  }
  return stakingRewards
}

export function updateCurrentEarnRate(contractAddress: Address): void {
  const contract = StakingRewardsContract.bind(contractAddress)
  const callResult = contract.try_currentEarnRatePerToken()
  if (!callResult.reverted) {
    const stakingRewards = getStakingRewards()
    stakingRewards.currentEarnRatePerToken = callResult.value
    stakingRewards.save()

    const seniorPool = getOrInitSeniorPool()
    seniorPool.estimatedApyFromGfiRaw = calculateEstimatedApyFromGfiRaw(
      seniorPool.sharePrice,
      stakingRewards.currentEarnRatePerToken
    )
    seniorPool.save()
  }
}

import {PoolBacker, TranchedPoolToken} from "../../generated/schema"
import {
  BackerRewardsSetTotalRewards,
  BackerRewardsSetMaxInterestDollarsEligible,
  BackerRewardsClaimed,
} from "../../generated/templates/BackerRewards/BackerRewards"

import {updateBackerRewardsData} from "../entities/backer_rewards"
import {calculateApyFromGfiForAllPools} from "../entities/tranched_pool"

export function handleSetTotalRewards(event: BackerRewardsSetTotalRewards): void {
  updateBackerRewardsData(event.address)
  // It's a little odd to see this calculation initiated here, but it's in order to ensure that rewards are calculated if the backer contract is deployed after some pools
  calculateApyFromGfiForAllPools(event.block.timestamp)
}

export function handleSetMaxInterestDollarsEligible(event: BackerRewardsSetMaxInterestDollarsEligible): void {
  updateBackerRewardsData(event.address)
  // It's a little odd to see this calculation initiated here, but it's in order to ensure that rewards are calculated if the backer contract is deployed after some pools
  calculateApyFromGfiForAllPools(event.block.timestamp)
}

export function handleBackerRewardsClaimed(event: BackerRewardsClaimed): void {
  const poolToken = assert(TranchedPoolToken.load(event.params.tokenId.toString()))
  poolToken.rewardsClaimed = event.params.amountOfTranchedPoolRewards
  poolToken.stakingRewardsClaimed = event.params.amountOfSeniorPoolRewards
  poolToken.save()

  const poolBacker = assert(PoolBacker.load(`${poolToken.tranchedPool}-${poolToken.user}`))
  poolBacker.rewardsClaimed = poolBacker.rewardsClaimed.plus(event.params.amountOfTranchedPoolRewards)
  poolBacker.save()
}

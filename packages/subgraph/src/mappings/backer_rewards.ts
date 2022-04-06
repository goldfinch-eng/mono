import {
  BackerRewardsSetTotalRewards,
  BackerRewardsSetMaxInterestDollarsEligible,
} from "../../generated/templates/BackerRewards/BackerRewards"

import {updateBackerRewardsData} from "../entities/backer_rewards"

export function handleSetTotalRewards(event: BackerRewardsSetTotalRewards): void {
  updateBackerRewardsData(event.address)
}

export function handleSetMaxInterestDollarsEligible(event: BackerRewardsSetMaxInterestDollarsEligible): void {
  updateBackerRewardsData(event.address)
}

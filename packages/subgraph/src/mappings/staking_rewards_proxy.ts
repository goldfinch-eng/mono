import {ProxyImplementationUpdated} from "../../generated/StakingRewardsProxy/StakingRewards_Proxy"
import {StakingRewards as StakingRewardsTemplate} from "../../generated/templates"

import {updateCurrentEarnRate} from "../entities/staking_rewards"

export function handleProxyImplementationUpdated(event: ProxyImplementationUpdated): void {
  StakingRewardsTemplate.create(event.address)
  updateCurrentEarnRate(event.address)
}

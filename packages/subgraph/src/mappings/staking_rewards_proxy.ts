import {ProxyImplementationUpdated} from "../../generated/StakingRewardsProxy/StakingRewards_Proxy"
import {StakingRewards as StakingRewardsTemplate} from "../../generated/templates"

export function handleProxyImplementationUpdated(event: ProxyImplementationUpdated): void {
  StakingRewardsTemplate.create(event.address)
}

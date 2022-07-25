import {ProxyImplementationUpdated} from "../../generated/CommunityRewardsProxy/CommunityRewards_Proxy"
import {CommunityRewards as CommunityRewardsTemplate} from "../../generated/templates"

export function handleProxyImplementationUpdated(event: ProxyImplementationUpdated): void {
  CommunityRewardsTemplate.create(event.address)
}

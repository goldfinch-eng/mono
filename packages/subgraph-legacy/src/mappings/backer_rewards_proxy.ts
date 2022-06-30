import {ProxyImplementationUpdated} from "../../generated/BackerRewardsProxy/BackerRewards_Proxy"
import {BackerRewards as BackerRewardsTemplate} from "../../generated/templates"
import {updateBackerRewardsData} from "../entities/backer_rewards"

export function handleProxyImplementationUpdated(event: ProxyImplementationUpdated): void {
  BackerRewardsTemplate.create(event.address)
  updateBackerRewardsData(event.address)
}

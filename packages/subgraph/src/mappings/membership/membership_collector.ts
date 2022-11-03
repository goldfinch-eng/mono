import {EpochFinalized} from "../../../generated/MembershipCollector/MembershipCollector"
import {MembershipEpoch} from "../../../generated/schema"

export function handleEpochFinalized(event: EpochFinalized): void {
  const epoch = new MembershipEpoch(event.params.epoch.toString())
  epoch.epoch = event.params.epoch
  epoch.totalRewards = event.params.totalRewards
  epoch.finalizedAt = event.block.timestamp.toI32()
  epoch.save()
}

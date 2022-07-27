import {GfiGrant} from "../../generated/schema"
import {RewardPaid, GrantRevoked} from "../../generated/templates/CommunityRewards/CommunityRewards"

export function handleRewardPaid(event: RewardPaid): void {
  const gfiGrant = assert(GfiGrant.load(event.params.tokenId.toString()))
  gfiGrant.totalClaimed = gfiGrant.totalClaimed.plus(event.params.reward)
  gfiGrant.save()
}

export function handleGrantRevoked(event: GrantRevoked): void {
  const gfiGrant = assert(GfiGrant.load(event.params.tokenId.toString()))
  gfiGrant.revokedAt = event.block.timestamp
  gfiGrant.save()
}

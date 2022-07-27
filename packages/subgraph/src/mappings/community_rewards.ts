import {CommunityRewardsToken} from "../../generated/schema"
import {RewardPaid, GrantRevoked} from "../../generated/templates/CommunityRewards/CommunityRewards"

export function handleRewardPaid(event: RewardPaid): void {
  const communityRewardsToken = assert(CommunityRewardsToken.load(event.params.tokenId.toString()))
  communityRewardsToken.totalClaimed = communityRewardsToken.totalClaimed.plus(event.params.reward)
  communityRewardsToken.save()
}

export function handleGrantRevoked(event: GrantRevoked): void {
  const communityRewardsToken = assert(CommunityRewardsToken.load(event.params.tokenId.toString()))
  communityRewardsToken.revokedAt = event.block.timestamp
  communityRewardsToken.save()
}

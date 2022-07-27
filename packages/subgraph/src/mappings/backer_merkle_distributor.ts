import {CommunityRewardsToken} from "../../generated/schema"
import {GrantAccepted} from "../../generated/BackerMerkleDistributor/BackerMerkleDistributor"

export function handleGrantAccepted(event: GrantAccepted): void {
  const communityRewardsToken = new CommunityRewardsToken(event.params.tokenId.toString())
  communityRewardsToken.user = event.params.account.toHexString()
  communityRewardsToken.source = "BACKER_MERKLE_DISTRIBUTOR"
  communityRewardsToken.index = event.params.index.toI32()
  communityRewardsToken.totalGranted = event.params.amount
  communityRewardsToken.grantedAt = event.block.timestamp
  communityRewardsToken.cliffLength = event.params.cliffLength
  communityRewardsToken.vestingInterval = event.params.vestingInterval
  communityRewardsToken.save()
}

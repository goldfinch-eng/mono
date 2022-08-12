import {CommunityRewardsToken} from "../../generated/schema"
import {
  CommunityRewards as CommunityRewardsContract,
  Granted,
  RewardPaid,
  GrantRevoked,
} from "../../generated/templates/CommunityRewards/CommunityRewards"

// Seems redundant, but this handler gets used to add the startTime/endTime info on tokens
// Remember that this actually runs _before_ GrantAccepted. We can let GrantAccepted fill out the other details.
export function handleGranted(event: Granted): void {
  const communityRewardsToken = new CommunityRewardsToken(event.params.tokenId.toString())
  const communityRewardsContract = CommunityRewardsContract.bind(event.address)
  const tokenLaunchTime = communityRewardsContract.tokenLaunchTimeInSeconds()
  communityRewardsToken.startTime = tokenLaunchTime
  communityRewardsToken.endTime = communityRewardsToken.startTime.plus(event.params.vestingLength)
  communityRewardsToken.save()
}

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

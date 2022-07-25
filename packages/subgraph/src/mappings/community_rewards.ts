import {GfiGrant} from "../../generated/schema"
import {Granted} from "../../generated/templates/CommunityRewards/CommunityRewards"

export function handleGranted(event: Granted): void {
  const gfiGrant = new GfiGrant(event.params.tokenId.toString())
  gfiGrant.user = event.params.user.toHexString()
  gfiGrant.totalGranted = event.params.amount
  gfiGrant.grantedAt = event.block.timestamp
  gfiGrant.cliffLength = event.params.cliffLength
  gfiGrant.vestingInterval = event.params.vestingInterval
  gfiGrant.save()
}

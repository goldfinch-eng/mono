import {GfiGrant} from "../../generated/schema"
import {GrantAccepted} from "../../generated/MerkleDistributor/MerkleDistributor"

export function handleGrantAccepted(event: GrantAccepted): void {
  const gfiGrant = new GfiGrant(event.params.tokenId.toString())
  gfiGrant.user = event.params.account.toHexString()
  gfiGrant.source = "MERKLE_DISTRIBUTOR"
  gfiGrant.index = event.params.index.toI32()
  gfiGrant.totalGranted = event.params.amount
  gfiGrant.grantedAt = event.block.timestamp
  gfiGrant.cliffLength = event.params.cliffLength
  gfiGrant.vestingInterval = event.params.vestingInterval
  gfiGrant.save()
}

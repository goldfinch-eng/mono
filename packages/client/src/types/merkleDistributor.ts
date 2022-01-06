import BigNumber from "bignumber.js"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"

export type AcceptedMerkleDistributorGrant = {
  accepted: true
  grantInfo: MerkleDistributorGrantInfo
  // For an accepted grant, we leave these values undefined as they are tracked via UserCommunityRewards.
  granted: undefined
  vested: undefined
  claimable: undefined
  unvested: undefined
}
export type NotAcceptedMerkleDistributorGrant = {
  accepted: false
  grantInfo: MerkleDistributorGrantInfo
  granted: BigNumber
  vested: BigNumber
  claimable: BigNumber
  unvested: BigNumber
}

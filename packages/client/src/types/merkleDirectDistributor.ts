import BigNumber from "bignumber.js"
import {MerkleDirectDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"

export type AcceptedMerkleDirectDistributorGrant = {
  accepted: true
  grantInfo: MerkleDirectDistributorGrantInfo
  granted: BigNumber
  vested: BigNumber
  claimable: BigNumber
  unvested: BigNumber
}
export type NotAcceptedMerkleDirectDistributorGrant = {
  accepted: false
  grantInfo: MerkleDirectDistributorGrantInfo
  granted: BigNumber
  vested: BigNumber
  claimable: BigNumber
  unvested: BigNumber
}
export type MerkleDirectDistributorGrant =
  | AcceptedMerkleDirectDistributorGrant
  | NotAcceptedMerkleDirectDistributorGrant

import BigNumber from "bignumber.js"
import {MerkleDirectDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {EventData} from "web3-eth-contract"

export type AcceptedMerkleDirectDistributorGrant = {
  accepted: true
  grantInfo: MerkleDirectDistributorGrantInfo
  granted: BigNumber
  vested: BigNumber
  claimable: BigNumber
  unvested: BigNumber
  acceptEvent?: EventData
}
export type NotAcceptedMerkleDirectDistributorGrant = {
  accepted: false
  grantInfo: MerkleDirectDistributorGrantInfo
  granted: BigNumber
  vested: BigNumber
  claimable: BigNumber
  unvested: BigNumber
  acceptEvent?: undefined
}
export type MerkleDirectDistributorGrant =
  | AcceptedMerkleDirectDistributorGrant
  | NotAcceptedMerkleDirectDistributorGrant

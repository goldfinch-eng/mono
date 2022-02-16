import {BackerMerkleDirectDistributor as BackerMerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDirectDistributor"
import {WithLoadedInfo} from "../types/loadable"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDirectDistributor, MerkleDirectDistributorLoadedInfo} from "./merkleDirectDistributor"

type BackerMerkleDirectDistributorLoadedInfo = MerkleDirectDistributorLoadedInfo

export type BackerMerkleDirectDistributorLoaded = WithLoadedInfo<
  BackerMerkleDirectDistributor,
  BackerMerkleDirectDistributorLoadedInfo
>

export class BackerMerkleDirectDistributor extends MerkleDirectDistributor {
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol)
    this.contract = goldfinchProtocol.getContract<BackerMerkleDirectDistributorContract>(
      "BackerMerkleDirectDistributor"
    )
    this.address = goldfinchProtocol.getAddress("BackerMerkleDirectDistributor")
  }
}

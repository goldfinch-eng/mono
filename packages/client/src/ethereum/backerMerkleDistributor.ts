import {BackerMerkleDistributor as BackerMerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDistributor"
import {WithLoadedInfo} from "../types/loadable"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDistributor, MerkleDistributorLoadedInfo} from "./merkleDistributor"

type BackerMerkleDistributorLoadedInfo = MerkleDistributorLoadedInfo

export type BackerMerkleDistributorLoaded = WithLoadedInfo<BackerMerkleDistributor, BackerMerkleDistributorLoadedInfo>

export class BackerMerkleDistributor extends MerkleDistributor {
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol)
    this.contract = goldfinchProtocol.getContract<BackerMerkleDistributorContract>("BackerMerkleDistributor")
    this.address = goldfinchProtocol.getAddress("BackerMerkleDistributor")
  }
}

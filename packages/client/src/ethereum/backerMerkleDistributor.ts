import {BackerMerkleDistributor as BackerMerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDistributor"
import {WithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDistributor} from "./merkleDistributor"

type BackerMerkleDistributorLoadedInfo = {
  currentBlock: BlockInfo
}

export type BackerMerkleDistributorLoaded = WithLoadedInfo<BackerMerkleDistributor, BackerMerkleDistributorLoadedInfo>

export class BackerMerkleDistributor extends MerkleDistributor {
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol)
    this.contract = goldfinchProtocol.getContract<BackerMerkleDistributorContract>("BackerMerkleDistributor")
    this.address = goldfinchProtocol.getAddress("BackerMerkleDistributor")
  }
}

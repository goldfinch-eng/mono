import {BackerMerkleDirectDistributor as BackerMerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDirectDistributor"
import {WithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDirectDistributor} from "./merkleDirectDistributor"

type BackerMerkleDirectDistributorLoadedInfo = {
  currentBlock: BlockInfo
}

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

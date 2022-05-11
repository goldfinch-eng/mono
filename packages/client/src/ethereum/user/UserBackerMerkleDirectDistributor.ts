import {
  MerkleDirectDistributorGrantInfo,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {WithLoadedInfo} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import {MerkleDirectDistributorLoaded} from "../merkleDirectDistributor"
import {getBackerMerkleDirectDistributorInfo} from "../utils"
import {UserMerkleDirectDistributor, UserMerkleDirectDistributorLoadedInfo} from "./UserMerkleDirectDistributor"

export type UserBackerMerkleDirectDistributorLoaded = WithLoadedInfo<
  UserBackerMerkleDirectDistributor,
  UserMerkleDirectDistributorLoadedInfo
>

export class UserBackerMerkleDirectDistributor extends UserMerkleDirectDistributor {
  async getMerkleInfo(): Promise<MerkleDirectDistributorInfo | undefined> {
    return getBackerMerkleDirectDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return await UserBackerMerkleDirectDistributor.getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDirectDistributor,
      currentBlock
    )
  }
}

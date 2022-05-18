import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {WithLoadedInfo} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import {MerkleDistributorLoaded} from "../merkleDistributor"
import {getBackerMerkleDistributorInfo} from "../utils"
import {UserMerkleDistributor, UserMerkleDistributorLoadedInfo} from "./UserMerkleDistributor"

export type UserBackerMerkleDistributorLoaded = WithLoadedInfo<
  UserBackerMerkleDistributor,
  UserMerkleDistributorLoadedInfo
>

export class UserBackerMerkleDistributor extends UserMerkleDistributor {
  async getMerkleInfo(): Promise<MerkleDistributorInfo | undefined> {
    return getBackerMerkleDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return UserBackerMerkleDistributor.getAirdropsWithAcceptance(airdropsForRecipient, merkleDistributor, currentBlock)
  }
}

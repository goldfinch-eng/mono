import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import BigNumber from "bignumber.js"
import {Loadable, WithLoadedInfo} from "../../types/loadable"
import {AcceptedMerkleDistributorGrant, NotAcceptedMerkleDistributorGrant} from "../../types/merkleDistributor"
import {BlockInfo, defaultSum} from "../../utils"
import {CommunityRewardsLoaded} from "../communityRewards"
import {GoldfinchProtocol} from "../GoldfinchProtocol"
import {MerkleDistributorLoaded} from "../merkleDistributor"
import {getMerkleDistributorInfo} from "../utils"

export type UserMerkleDistributorLoaded = WithLoadedInfo<UserMerkleDistributor, UserMerkleDistributorLoadedInfo>

export type UserMerkleDistributorLoadedInfo = {
  currentBlock: BlockInfo
  merkleDistributorInfo: MerkleDistributorInfo
  airdrops: {
    accepted: AcceptedMerkleDistributorGrant[]
    notAccepted: NotAcceptedMerkleDistributorGrant[]
  }
  notAcceptedClaimable: BigNumber
  notAcceptedUnvested: BigNumber
}

export class UserMerkleDistributor {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserMerkleDistributorLoadedInfo>

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async getMerkleInfo(): Promise<MerkleDistributorInfo | undefined> {
    return getMerkleDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return UserMerkleDistributor.getAirdropsWithAcceptance(airdropsForRecipient, merkleDistributor, currentBlock)
  }

  async initialize(
    merkleDistributor: MerkleDistributorLoaded,
    communityRewards: CommunityRewardsLoaded,
    currentBlock: BlockInfo
  ): Promise<void> {
    const merkleDistributorInfo = await this.getMerkleInfo()
    if (!merkleDistributorInfo) {
      throw new Error("Failed to retrieve MerkleDistributor info.")
    }

    const airdropsForRecipient = UserMerkleDistributor.getAirdropsForRecipient(
      merkleDistributorInfo.grants,
      this.address
    )
    const [withAcceptance, _tokenLaunchTime] = await Promise.all([
      this._getAirdropsWithAcceptance(airdropsForRecipient, merkleDistributor, currentBlock),
      communityRewards.contract.readOnly.methods.tokenLaunchTimeInSeconds().call(undefined, currentBlock.number),
    ])
    const tokenLaunchTime = new BigNumber(_tokenLaunchTime)
    const airdrops = withAcceptance.reduce<{
      accepted: MerkleDistributorGrantInfo[]
      notAccepted: MerkleDistributorGrantInfo[]
    }>(
      (acc, curr) => {
        if (curr.isAccepted) {
          acc.accepted.push(curr.grantInfo)
        } else {
          acc.notAccepted.push(curr.grantInfo)
        }
        return acc
      },
      {accepted: [], notAccepted: []}
    )
    const accepted = airdrops.accepted.map(
      (grantInfo): AcceptedMerkleDistributorGrant => ({
        accepted: true,
        grantInfo,
        granted: undefined,
        vested: undefined,
        claimable: undefined,
        unvested: undefined,
      })
    )
    const notAccepted = await Promise.all(
      airdrops.notAccepted.map(async (grantInfo): Promise<NotAcceptedMerkleDistributorGrant> => {
        const granted = new BigNumber(grantInfo.grant.amount)
        const optimisticVested = new BigNumber(
          await communityRewards.contract.readOnly.methods
            .totalVestedAt(
              tokenLaunchTime.toString(10),
              tokenLaunchTime.plus(new BigNumber(grantInfo.grant.vestingLength)).toString(10),
              new BigNumber(grantInfo.grant.amount).toString(10),
              new BigNumber(grantInfo.grant.cliffLength).toString(10),
              new BigNumber(grantInfo.grant.vestingInterval).toString(10),
              0,
              currentBlock.timestamp
            )
            .call(undefined, currentBlock.number)
        )
        const vested = optimisticVested
        return {
          accepted: false,
          grantInfo,
          granted,
          vested,
          claimable: vested,
          unvested: granted.minus(vested),
        }
      })
    )

    const notAcceptedClaimable = defaultSum(notAccepted.map((val) => val.claimable))

    const notAcceptedUnvested = defaultSum(notAccepted.map((val) => val.unvested))

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDistributorInfo,
        airdrops: {
          accepted,
          notAccepted,
        },
        notAcceptedClaimable,
        notAcceptedUnvested,
      },
    }
  }

  static async getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return Promise.all(
      airdropsForRecipient.map(async (grantInfo) => ({
        grantInfo,
        isAccepted: await merkleDistributor.contract.readOnly.methods
          .isGrantAccepted(grantInfo.index)
          .call(undefined, currentBlock.number),
      }))
    )
  }

  static getAirdropsForRecipient(
    allAirdrops: MerkleDistributorGrantInfo[],
    recipient: string
  ): MerkleDistributorGrantInfo[] {
    return allAirdrops.filter((grantInfo) => grantInfo.account.toLowerCase() === recipient.toLowerCase())
  }
}

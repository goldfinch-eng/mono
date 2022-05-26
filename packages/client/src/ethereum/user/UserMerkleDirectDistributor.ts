import {
  MerkleDirectDistributorGrantInfo,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import BigNumber from "bignumber.js"
import {GRANT_ACCEPTED_EVENT} from "../../types/events"
import {Loadable, WithLoadedInfo} from "../../types/loadable"
import {
  AcceptedMerkleDirectDistributorGrant,
  NotAcceptedMerkleDirectDistributorGrant,
} from "../../types/merkleDirectDistributor"
import {assertNonNullable, BlockInfo, defaultSum} from "../../utils"
import {GoldfinchProtocol} from "../GoldfinchProtocol"
import {MerkleDirectDistributorLoaded} from "../merkleDirectDistributor"
import {getMerkleDirectDistributorInfo} from "../utils"

export type UserMerkleDirectDistributorLoaded = WithLoadedInfo<
  UserMerkleDirectDistributor,
  UserMerkleDirectDistributorLoadedInfo
>

export type UserMerkleDirectDistributorLoadedInfo = {
  currentBlock: BlockInfo
  merkleDirectDistributorInfo: MerkleDirectDistributorInfo
  airdrops: {
    accepted: AcceptedMerkleDirectDistributorGrant[]
    notAccepted: NotAcceptedMerkleDirectDistributorGrant[]
  }
  claimable: BigNumber
  unvested: BigNumber
}

export class UserMerkleDirectDistributor {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserMerkleDirectDistributorLoadedInfo>

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

  async getMerkleInfo(): Promise<MerkleDirectDistributorInfo | undefined> {
    return getMerkleDirectDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return UserMerkleDirectDistributor.getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDirectDistributor,
      currentBlock
    )
  }

  async initialize(merkleDirectDistributor: MerkleDirectDistributorLoaded, currentBlock: BlockInfo): Promise<void> {
    const merkleDirectDistributorInfo = await this.getMerkleInfo()
    if (!merkleDirectDistributorInfo) {
      throw new Error("Failed to retrieve MerkleDirectDistributor info.")
    }

    const airdropsForRecipient = UserMerkleDirectDistributor.getAirdropsForRecipient(
      merkleDirectDistributorInfo.grants,
      this.address
    )
    const withAcceptance = await this._getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDirectDistributor,
      currentBlock
    )
    const airdrops = withAcceptance.reduce<{
      accepted: MerkleDirectDistributorGrantInfo[]
      notAccepted: MerkleDirectDistributorGrantInfo[]
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

    const accepted = airdrops.accepted.map((grantInfo): AcceptedMerkleDirectDistributorGrant => {
      const granted = new BigNumber(grantInfo.grant.amount)
      const vested = granted
      return {
        accepted: true,
        grantInfo,
        granted,
        vested,
        // Direct grants that have been accepted have no further claimable amount.
        claimable: new BigNumber(0),
        unvested: granted.minus(vested),
      }
    })

    accepted.forEach(async (grant: AcceptedMerkleDirectDistributorGrant) => {
      const events = await this.goldfinchProtocol.queryEvents(
        merkleDirectDistributor.contract.readOnly,
        [GRANT_ACCEPTED_EVENT],
        {index: grant.grantInfo.index.toString()},
        currentBlock.number
      )
      if (events.length === 1) {
        const acceptanceEvent = events[0]
        assertNonNullable(acceptanceEvent)
        grant.acceptEvent = acceptanceEvent
      } else if (events.length === 0) {
        console.warn(
          `Failed to identify GrantAccepted event corresponding to Merkle Direct Distributor grant ${grant.grantInfo.index}.`
        )
      } else {
        throw new Error(
          `Identified more than one GrantAccepted event corresponding to Merkle Direct Distributor grant ${grant.grantInfo.index}.`
        )
      }
      return
    })

    const notAccepted = airdrops.notAccepted.map((grantInfo): NotAcceptedMerkleDirectDistributorGrant => {
      const granted = new BigNumber(grantInfo.grant.amount)
      const vested = granted
      return {
        accepted: false,
        grantInfo,
        granted,
        vested,
        claimable: vested,
        unvested: granted.minus(vested),
      }
    })

    const acceptedClaimable = defaultSum(accepted.map((val) => val.claimable))
    const notAcceptedClaimable = defaultSum(notAccepted.map((val) => val.claimable))
    const claimable = acceptedClaimable.plus(notAcceptedClaimable)

    const acceptedUnvested = defaultSum(accepted.map((val) => val.unvested))
    const notAcceptedUnvested = defaultSum(notAccepted.map((val) => val.unvested))
    const unvested = acceptedUnvested.plus(notAcceptedUnvested)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDirectDistributorInfo,
        airdrops: {
          accepted,
          notAccepted,
        },
        claimable,
        unvested,
      },
    }
  }

  static async getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return Promise.all(
      airdropsForRecipient.map(async (grantInfo) => ({
        grantInfo,
        isAccepted: await merkleDirectDistributor.contract.readOnly.methods
          .isGrantAccepted(grantInfo.index)
          .call(undefined, currentBlock.number),
      }))
    )
  }

  static getAirdropsForRecipient(
    allAirdrops: MerkleDirectDistributorGrantInfo[],
    recipient: string
  ): MerkleDirectDistributorGrantInfo[] {
    return allAirdrops.filter((grantInfo) => grantInfo.account.toLowerCase() === recipient.toLowerCase())
  }
}

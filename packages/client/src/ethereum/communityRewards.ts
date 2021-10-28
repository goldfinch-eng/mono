import {EventData} from "web3-eth-contract"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import BigNumber from "bignumber.js"
import {assertNonNullable, BlockInfo, getBlockInfo, getCurrentBlock} from "../utils"
import {getMerkleDistributorInfo} from "./utils"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../types/loadable"

type MerkleDistributorLoadedInfo = {
  currentBlock: BlockInfo
  communityRewards: CommunityRewardsLoaded
  merkleDistributorInfo: MerkleDistributorInfo
  actionRequiredAirdrops: MerkleDistributorGrantInfo[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

export type MerkleDistributorLoaded = WithLoadedInfo<MerkleDistributor, MerkleDistributorLoadedInfo>

export class MerkleDistributor {
  goldfinchProtocol: GoldfinchProtocol
  contract: MerkleDistributorContract
  address: string
  info: Loadable<MerkleDistributorLoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<MerkleDistributorContract>("MerkleDistributor")
    this.address = goldfinchProtocol.getAddress("MerkleDistributor")
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(recipient: string): Promise<void> {
    const communityRewards = new CommunityRewards(this.goldfinchProtocol)

    const contractAddress = await this.contract.methods.communityRewards().call()
    if (contractAddress !== communityRewards.address) {
      throw new Error(
        "MerkleDistributor community rewards address doesn't match with deployed CommunityRewards address"
      )
    }

    const merkleDistributorInfo = await getMerkleDistributorInfo()
    if (!merkleDistributorInfo) return

    const currentBlock = getBlockInfo(await getCurrentBlock())

    await communityRewards.initialize(recipient, currentBlock)
    assertWithLoadedInfo(communityRewards)

    const claimable = MerkleDistributor.calculateClaimable(communityRewards.info.value.grants)
    const unvested = MerkleDistributor.calculateUnvested(communityRewards.info.value.grants)
    const granted = MerkleDistributor.calculateGranted(communityRewards.info.value.grants)

    const airdropsForRecipient = MerkleDistributor.getAirdropsForRecipient(merkleDistributorInfo.grants, recipient)
    const actionRequiredAirdrops = await this.getActionRequiredAirdrops(airdropsForRecipient, currentBlock)

    await Promise.all(
      communityRewards.info.value.grants.map(async (acceptedGrant): Promise<void> => {
        const events = await this.goldfinchProtocol.queryEvent(
          this.contract,
          "GrantAccepted",
          {tokenId: acceptedGrant.tokenId},
          currentBlock.number
        )
        if (events.length === 1) {
          const grantAcceptedEvent = events[0]
          assertNonNullable(grantAcceptedEvent)
          const airdrop = airdropsForRecipient.find(
            (airdrop) => parseInt(grantAcceptedEvent.returnValues.index, 10) === airdrop.index
          )
          if (airdrop) {
            acceptedGrant._reason = airdrop.reason
          } else {
            throw new Error(
              `Failed to identify airdrop corresponding to GrantAccepted event ${acceptedGrant.tokenId}, among user's airdrops.`
            )
          }
        } else if (events.length === 0) {
          // This is not necessarily an error, because in theory it's possible the grant was accepted
          // not via the `MerkleDistributor.acceptGrant()`, but instead by having been issued directly
          // via `CommunityRewards.grant()`.
          console.warn(
            `Failed to identify GrantAccepted event corresponding to CommunityRewards grant ${acceptedGrant.tokenId}.`
          )
        } else {
          throw new Error(
            `Identified more than one GrantAccepted event corresponding to CommunityRewards grant ${acceptedGrant.tokenId}.`
          )
        }
      })
    )

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDistributorInfo,
        communityRewards,
        actionRequiredAirdrops,
        claimable,
        unvested,
        granted,
      },
    }
  }

  async getActionRequiredAirdrops(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    currentBlock: BlockInfo
  ): Promise<MerkleDistributorGrantInfo[]> {
    return Promise.all(
      airdropsForRecipient.map(async (grantInfo) => {
        const isAccepted = await this.contract.methods
          .isGrantAccepted(grantInfo.index)
          .call(undefined, currentBlock.number)
        return !isAccepted ? grantInfo : undefined
      })
    ).then((results) => results.filter((val): val is NonNullable<typeof val> => !!val))
  }

  static getAirdropsForRecipient(
    allAirdrops: MerkleDistributorGrantInfo[],
    recipient: string
  ): MerkleDistributorGrantInfo[] {
    return allAirdrops.filter((grantInfo) => grantInfo.account === recipient)
  }

  static calculateClaimable(grants: CommunityRewardsGrant[]): BigNumber {
    if (grants.length === 0) return new BigNumber(0)
    const claimableResults = grants.map((grant) => grant.claimable)
    return BigNumber.sum.apply(null, claimableResults)
  }

  static calculateUnvested(grants: CommunityRewardsGrant[]): BigNumber {
    if (grants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      grants.map((grant) => grant.rewards.totalGranted.minus(grant.rewards.totalClaimed.plus(grant.claimable)))
    )
  }

  static calculateGranted(grants: CommunityRewardsGrant[]): BigNumber {
    if (grants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      grants.map((grant) => grant.rewards.totalGranted)
    )
  }
}

interface CommunityRewardsVestingRewards {
  totalGranted: BigNumber
  totalClaimed: BigNumber
  startTime: number
  endTime: number
  cliffLength: BigNumber
  vestingInterval: BigNumber
  revokedAt: number
}

export class CommunityRewardsGrant {
  tokenId: string
  user: string
  claimable: BigNumber
  rewards: CommunityRewardsVestingRewards
  _reason?: string

  constructor(tokenId: string, user: string, claimable: BigNumber, rewards: CommunityRewardsVestingRewards) {
    this.tokenId = tokenId
    this.user = user
    this.rewards = rewards
    this.claimable = claimable
  }

  get reason(): string {
    return !this._reason ? "Community Rewards" : this._reason
  }

  get granted(): BigNumber {
    return this.rewards.totalGranted
  }

  get claimed(): BigNumber {
    return this.rewards.totalClaimed
  }
}

function parseCommunityRewardsGrant(
  tokenId: string,
  user: string,
  claimable: string,
  tuple: {
    0: string
    1: string
    2: string
    3: string
    4: string
    5: string
    6: string
  }
): CommunityRewardsGrant {
  return new CommunityRewardsGrant(tokenId, user, new BigNumber(claimable), {
    totalGranted: new BigNumber(tuple[0]),
    totalClaimed: new BigNumber(tuple[1]),
    startTime: parseInt(tuple[2], 10),
    endTime: parseInt(tuple[3], 10),
    cliffLength: new BigNumber(tuple[4]),
    vestingInterval: new BigNumber(tuple[5]),
    revokedAt: parseInt(tuple[6], 10),
  })
}

type CommunityRewardsLoadedInfo = {
  currentBlock: BlockInfo
  grants: CommunityRewardsGrant[]
}

export type CommunityRewardsLoaded = WithLoadedInfo<CommunityRewards, CommunityRewardsLoadedInfo>

export class CommunityRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: CommunityRewardsContract
  address: string
  info: Loadable<CommunityRewardsLoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<CommunityRewardsContract>("CommunityRewards")
    this.address = goldfinchProtocol.getAddress("CommunityRewards")
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(recipient: string, currentBlock: BlockInfo): Promise<void> {
    // NOTE: In defining `this.grants`, we want to use `balanceOf()` plus `tokenOfOwnerByIndex`
    // to determine `tokenIds`, rather than using the set of Granted events for the `recipient`.
    // The former approach reflects any token transfers that may have occurred to or from the
    // `recipient`, whereas the latter does not.
    const numPositions = parseInt(
      await this.contract.methods.balanceOf(recipient).call(undefined, currentBlock.number),
      10
    )
    const tokenIds: string[] = await Promise.all(
      Array(numPositions)
        .fill("")
        .map((val, i) => this.contract.methods.tokenOfOwnerByIndex(recipient, i).call(undefined, currentBlock.number))
    )
    const grants = await Promise.all(
      tokenIds.map((tokenId) =>
        this.contract.methods
          .grants(tokenId)
          .call(undefined, currentBlock.number)
          .then(async (grant) => {
            const claimable = await this.contract.methods.claimableRewards(tokenId).call(undefined, currentBlock.number)
            return parseCommunityRewardsGrant(tokenId, recipient, claimable, grant)
          })
      )
    )
    this.info = {
      loaded: true,
      value: {
        currentBlock,
        grants,
      },
    }
  }

  async getGrantedEvents(recipient: string): Promise<EventData[]> {
    const eventNames = ["Granted"]
    const events = await this.goldfinchProtocol.queryEvents(this.contract, eventNames, {user: recipient})
    return events
  }
}

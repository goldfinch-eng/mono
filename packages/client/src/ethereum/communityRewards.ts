import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import BigNumber from "bignumber.js"
import {BlockNumber} from "web3-core"
import {Filter, EventData} from "web3-eth-contract"
import {CommunityRewardsEventType, KnownEventData} from "../types/events"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {Web3IO} from "../types/web3"
import {BlockInfo, displayNumber} from "../utils"
import {gfiFromAtomic} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDistributor} from "./merkleDistributor"

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
  claimable: BigNumber
  rewards: CommunityRewardsVestingRewards
  grantInfo: MerkleDistributorGrantInfo | undefined
  acceptEvent: EventData

  constructor(
    tokenId: string,
    claimable: BigNumber,
    rewards: CommunityRewardsVestingRewards,
    grantInfo: MerkleDistributorGrantInfo | undefined,
    acceptEvent: EventData
  ) {
    this.tokenId = tokenId
    this.rewards = rewards
    this.claimable = claimable
    this.grantInfo = grantInfo
    this.acceptEvent = acceptEvent
  }

  get displayReason(): string {
    return this.grantInfo ? MerkleDistributor.getDisplayReason(this.grantInfo.reason) : "in Community Rewards"
  }

  get title(): string {
    return this.grantInfo ? MerkleDistributor.getDisplayTitle(this.grantInfo.reason) : "Community Rewards"
  }

  get description(): string {
    const transactionDate = new Date(this.rewards.startTime * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    return `${displayNumber(gfiFromAtomic(this.granted))} GFI reward on ${transactionDate} for participating ${
      this.displayReason
    }`
  }

  get shortDescription(): string {
    const transactionDate = new Date(this.rewards.startTime * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    return `${displayNumber(gfiFromAtomic(this.granted))} GFI • ${transactionDate}`
  }

  get granted(): BigNumber {
    return this.rewards.totalGranted
  }

  get vested(): BigNumber {
    return this.rewards.totalClaimed.plus(this.claimable)
  }

  get unvested(): BigNumber {
    return this.granted.minus(this.vested)
  }

  get claimed(): BigNumber {
    return this.rewards.totalClaimed
  }

  get revoked(): boolean {
    return this.rewards.revokedAt > 0
  }
}

type CommunityRewardsLoadedInfo = {
  currentBlock: BlockInfo
}

export type CommunityRewardsLoaded = WithLoadedInfo<CommunityRewards, CommunityRewardsLoadedInfo>

export class CommunityRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<CommunityRewardsContract>
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

  async initialize(currentBlock: BlockInfo): Promise<void> {
    this.info = {
      loaded: true,
      value: {
        currentBlock,
      },
    }
  }

  async getEvents<T extends CommunityRewardsEventType>(
    address: string,
    eventNames: T[],
    filter: Filter | undefined,
    toBlock: BlockNumber
  ): Promise<KnownEventData<T>[]> {
    const events = await this.goldfinchProtocol.queryEvents(
      this.contract.readOnly,
      eventNames,
      {
        ...(filter || {}),
        user: address,
      },
      toBlock
    )
    return events
  }
}

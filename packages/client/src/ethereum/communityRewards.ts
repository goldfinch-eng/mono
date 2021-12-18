import {
  DirectGrantReason,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {MerkleDistributorGrantInfo} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import {MerkleDirectDistributor as MerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDirectDistributor"
import BigNumber from "bignumber.js"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {CommunityRewardsEventType, KnownEventData, MerkleDirectDistributorEventType} from "../types/events"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {BlockInfo, displayNumber} from "../utils"
import {gfiFromAtomic} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDistributor} from "./merkleDistributor"
import {getMerkleDirectDistributorInfo} from "./utils"

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

  constructor(
    tokenId: string,
    claimable: BigNumber,
    rewards: CommunityRewardsVestingRewards,
    grantInfo: MerkleDistributorGrantInfo | undefined
  ) {
    this.tokenId = tokenId
    this.rewards = rewards
    this.claimable = claimable
    this.grantInfo = grantInfo
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
      this.contract,
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

type MerkleDirectDistributorLoadedInfo = {
  currentBlock: BlockInfo
  merkleDirectDistributorInfo: MerkleDirectDistributorInfo
}

export type MerkleDirectDistributorLoaded = WithLoadedInfo<MerkleDirectDistributor, MerkleDirectDistributorLoadedInfo>

export class MerkleDirectDistributor {
  goldfinchProtocol: GoldfinchProtocol
  contract: MerkleDirectDistributorContract
  address: string
  info: Loadable<MerkleDirectDistributorLoadedInfo>

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<MerkleDirectDistributorContract>("MerkleDirectDistributor")
    this.address = goldfinchProtocol.getAddress("MerkleDirectDistributor")
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(currentBlock: BlockInfo): Promise<void> {
    const gfiAddress = await this.contract.methods.gfi().call(undefined, currentBlock.number)
    if (gfiAddress !== this.goldfinchProtocol.getAddress("GFI")) {
      throw new Error("MerkleDirectDistributor address of GFI contract doesn't match with deployed GFI address")
    }

    const merkleDirectDistributorInfo = await getMerkleDirectDistributorInfo(this.goldfinchProtocol.networkId)
    if (!merkleDirectDistributorInfo) {
      throw new Error("Failed to retrieve MerkleDirectDistributor info.")
    }

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDirectDistributorInfo,
      },
    }
  }

  async getEvents<T extends MerkleDirectDistributorEventType>(
    address: string,
    eventNames: T[],
    filter: Filter | undefined,
    toBlock: BlockNumber
  ): Promise<KnownEventData<T>[]> {
    const events = await this.goldfinchProtocol.queryEvents(
      this.contract,
      eventNames,
      {
        ...(filter || {}),
        account: address,
      },
      toBlock
    )
    return events
  }

  static getDisplayTitle(reason: DirectGrantReason): string {
    return MerkleDistributor.getDisplayTitle(reason)
  }

  static getDisplayReason(reason: DirectGrantReason): string {
    return MerkleDistributor.getDisplayReason(reason)
  }
}

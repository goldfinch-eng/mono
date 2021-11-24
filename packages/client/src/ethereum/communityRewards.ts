import {
  GrantReason,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {
  DirectGrantReason,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {MerkleDirectDistributor as MerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDirectDistributor"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import startCase from "lodash/startCase"
import {Filter} from "web3-eth-contract"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {BlockInfo, displayNumber} from "../utils"
import {
  CommunityRewardsEventType,
  KnownEventData,
  MerkleDirectDistributorEventType,
  MerkleDistributorEventType,
} from "../types/events"
import {gfiFromAtomic} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {getMerkleDirectDistributorInfo, getMerkleDistributorInfo} from "./utils"
import {BlockNumber} from "web3-core"

type MerkleDistributorLoadedInfo = {
  currentBlock: BlockInfo
  merkleDistributorInfo: MerkleDistributorInfo
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

  async initialize(currentBlock: BlockInfo): Promise<void> {
    const contractAddress = await this.contract.methods.communityRewards().call(undefined, currentBlock.number)
    if (contractAddress !== this.goldfinchProtocol.getAddress("CommunityRewards")) {
      throw new Error(
        "MerkleDistributor community rewards address doesn't match with deployed CommunityRewards address"
      )
    }

    const merkleDistributorInfo = await getMerkleDistributorInfo()
    if (!merkleDistributorInfo) {
      throw new Error("Failed to retrieve MerkleDistributor info.")
    }

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDistributorInfo,
      },
    }
  }

  async getEvents<T extends MerkleDistributorEventType>(
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

  static getDisplayTitle(reason: GrantReason): string {
    return reason
      .split("_")
      .map((s) => startCase(s))
      .join(" ")
  }

  static getDisplayReason(reason: GrantReason): string {
    switch (reason) {
      case "flight_academy":
        return "in Flight Academy"
      case "goldfinch_investment":
        return "as a Goldfinch investor"
      case "liquidity_provider":
        return "as a Liquidity Provider"
      default:
        assertUnreachable(reason)
    }
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
  claimable: BigNumber
  rewards: CommunityRewardsVestingRewards
  reason: GrantReason | undefined

  constructor(
    tokenId: string,
    claimable: BigNumber,
    rewards: CommunityRewardsVestingRewards,
    reason: GrantReason | undefined
  ) {
    this.tokenId = tokenId
    this.rewards = rewards
    this.claimable = claimable
    this.reason = reason
  }

  get displayReason(): string {
    return this.reason ? MerkleDistributor.getDisplayReason(this.reason) : "in Community Rewards"
  }

  get title(): string {
    return this.reason ? MerkleDistributor.getDisplayTitle(this.reason) : "Community Rewards"
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
    const contractAddress = await this.contract.methods.gfi().call(undefined, currentBlock.number)
    if (contractAddress !== this.goldfinchProtocol.getAddress("GFI")) {
      throw new Error("MerkleDirectDistributor address of GFI contract doesn't match with deployed GFI address")
    }

    const merkleDirectDistributorInfo = await getMerkleDirectDistributorInfo()
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
        user: address,
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

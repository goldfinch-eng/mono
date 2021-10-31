import {
  GrantReason,
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import BigNumber from "bignumber.js"
import {EventData} from "web3-eth-contract"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {getMerkleDistributorInfo} from "./utils"

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
    if (!merkleDistributorInfo) return

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDistributorInfo,
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
  _reason: GrantReason | undefined

  constructor(
    tokenId: string,
    claimable: BigNumber,
    rewards: CommunityRewardsVestingRewards,
    reason: GrantReason | undefined
  ) {
    this.tokenId = tokenId
    this.rewards = rewards
    this.claimable = claimable
    this._reason = reason
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

  async getGrantedEvents(recipient: string, currentBlock: BlockInfo): Promise<EventData[]> {
    const eventNames = ["Granted"]
    const events = await this.goldfinchProtocol.queryEvents(
      this.contract,
      eventNames,
      {user: recipient},
      currentBlock.number
    )
    return events
  }
}

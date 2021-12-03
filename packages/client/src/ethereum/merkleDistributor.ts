import {
  GrantReason,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import startCase from "lodash/startCase"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {KnownEventData, MerkleDistributorEventType} from "../types/events"
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
    const communityRewardsAddress = await this.contract.methods.communityRewards().call(undefined, currentBlock.number)
    if (communityRewardsAddress !== this.goldfinchProtocol.getAddress("CommunityRewards")) {
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
        account: address,
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
      case "flight_academy_and_liquidity_provider":
        return "in Flight Academy and as a Liquidity Provider"
      default:
        assertUnreachable(reason)
    }
  }
}

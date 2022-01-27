import {GrantReason} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {BackerMerkleDistributor as BackerMerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDistributor"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import startCase from "lodash/startCase"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {KnownEventData, MerkleDistributorEventType} from "../types/events"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"

type MerkleDistributorLoadedInfo = {
  currentBlock: BlockInfo
}

export type MerkleDistributorLoaded = WithLoadedInfo<MerkleDistributor, MerkleDistributorLoadedInfo>

export class MerkleDistributor {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<MerkleDistributorContract>
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
    const communityRewardsAddress = await this.contract.readOnly.methods
      .communityRewards()
      .call(undefined, currentBlock.number)
    if (communityRewardsAddress !== this.goldfinchProtocol.getAddress("CommunityRewards")) {
      throw new Error(
        "MerkleDistributor community rewards address doesn't match with deployed CommunityRewards address"
      )
    }

    this.info = {
      loaded: true,
      value: {
        currentBlock,
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
      this.contract.readOnly,
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
      case "advisor":
        return "as a Goldfinch advisor"
      case "contributor":
        return "as a Goldfinch contributor"
      default:
        assertUnreachable(reason)
    }
  }
}

export class BackerMerkleDistributor extends MerkleDistributor {
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol)
    this.contract = goldfinchProtocol.getContract<BackerMerkleDistributorContract>("BackerMerkleDistributor")
    this.address = goldfinchProtocol.getAddress("BackerMerkleDistributor")
  }
}

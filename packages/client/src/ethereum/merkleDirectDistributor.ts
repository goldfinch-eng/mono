import {DirectGrantReason} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {MerkleDirectDistributor as MerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDirectDistributor"
import {BackerMerkleDirectDistributor as BackerMerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/BackerMerkleDirectDistributor"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {KnownEventData, MerkleDirectDistributorEventType} from "../types/events"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {Web3IO} from "../types/web3"
import {BlockInfo} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDistributor} from "./merkleDistributor"

type BackerMerkleDirectDistributorLoadedInfo = {
  currentBlock: BlockInfo
}

export type BackerMerkleDirectDistributorLoaded = WithLoadedInfo<
  BackerMerkleDirectDistributor,
  BackerMerkleDirectDistributorLoadedInfo
>

type MerkleDirectDistributorLoadedInfo = {
  currentBlock: BlockInfo
}

export type MerkleDirectDistributorLoaded = WithLoadedInfo<MerkleDirectDistributor, MerkleDirectDistributorLoadedInfo>

export class MerkleDirectDistributor {
  goldfinchProtocol: GoldfinchProtocol
  contract: Web3IO<MerkleDirectDistributorContract>
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
    const gfiAddress = await this.contract.readOnly.methods.gfi().call(undefined, currentBlock.number)
    if (gfiAddress !== this.goldfinchProtocol.getAddress("GFI")) {
      throw new Error("MerkleDirectDistributor address of GFI contract doesn't match with deployed GFI address")
    }

    this.info = {
      loaded: true,
      value: {
        currentBlock,
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

  static getDisplayTitle(reason: DirectGrantReason): string {
    return MerkleDistributor.getDisplayTitle(reason)
  }

  static getDisplayReason(reason: DirectGrantReason): string {
    return MerkleDistributor.getDisplayReason(reason)
  }
}

export class BackerMerkleDirectDistributor extends MerkleDirectDistributor {
  constructor(goldfinchProtocol: GoldfinchProtocol) {
    super(goldfinchProtocol)
    this.contract = goldfinchProtocol.getContract<BackerMerkleDirectDistributorContract>(
      "BackerMerkleDirectDistributor"
    )
    this.address = goldfinchProtocol.getAddress("BackerMerkleDirectDistributor")
  }
}

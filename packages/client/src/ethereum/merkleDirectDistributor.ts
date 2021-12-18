import {
  DirectGrantReason,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {MerkleDirectDistributor as MerkleDirectDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDirectDistributor"
import {BlockNumber} from "web3-core"
import {Filter} from "web3-eth-contract"
import {KnownEventData, MerkleDirectDistributorEventType} from "../types/events"
import {Loadable, WithLoadedInfo} from "../types/loadable"
import {BlockInfo} from "../utils"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDistributor} from "./merkleDistributor"
import {getMerkleDirectDistributorInfo} from "./utils"

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

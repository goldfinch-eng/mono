import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import {GoldfinchProtocol} from "../GoldfinchProtocol"
import {getMerkleDistributorInfo} from "../utils"
import {MerkleDistributorGrantInfo, MerkleDistributorInfo} from "./types"

export class MerkleDistributor {
  goldfinchProtocol: GoldfinchProtocol
  contract: MerkleDistributorContract
  address: string
  _loaded: boolean
  info: MerkleDistributorInfo | undefined

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<MerkleDistributorContract>("MerkleDistributor")
    this.address = goldfinchProtocol.getAddress("MerkleDistributor")
    this._loaded = true
  }

  async initialize() {
    const info = await getMerkleDistributorInfo()
    if (info) {
      this.info = info
    }
  }

  getGrants(recipient: string): MerkleDistributorGrantInfo[] | undefined {
    if (this.info) {
      return this.info.grants.filter((grant) => grant.account === recipient)
    } else {
      return
    }
  }
}

export class CommunityRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: CommunityRewardsContract
  address: string
  _loaded: boolean

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<CommunityRewardsContract>("CommunityRewards")
    this.address = goldfinchProtocol.getAddress("CommunityRewards")
    this._loaded = true
  }

  async initialize() {}
}

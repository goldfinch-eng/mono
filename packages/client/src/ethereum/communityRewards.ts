import {EventData} from "web3-eth-contract"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {getMerkleDistributorInfo} from "./utils"
import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import BigNumber from "bignumber.js"

export class MerkleDistributor {
  goldfinchProtocol: GoldfinchProtocol
  contract: MerkleDistributorContract
  address: string
  _loaded: boolean
  info: MerkleDistributorInfo | undefined
  acceptedGrants: CommunityRewardsVesting[]
  communityRewards: CommunityRewards
  totalClaimable: BigNumber
  stillVesting: BigNumber
  granted: BigNumber

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<MerkleDistributorContract>("MerkleDistributor")
    this.address = goldfinchProtocol.getAddress("MerkleDistributor")
    this.acceptedGrants = []
    this.communityRewards = new CommunityRewards(goldfinchProtocol)
    this.totalClaimable = new BigNumber(0)
    this.stillVesting = new BigNumber(0)
    this.granted = new BigNumber(0)
    this._loaded = true
  }

  async initialize(recipient: string) {
    const info = await getMerkleDistributorInfo()
    if (!info) return
    this.info = info

    await this.communityRewards.initialize(recipient)
    this.acceptedGrants = this.communityRewards.grants
    this.totalClaimable = await this.calculateTotalClaimable()
    this.stillVesting = this.calculateStillVesting()
    this.granted = this.calculateGranted()
    this._loaded = true
  }

  getGrants(recipient: string): MerkleDistributorGrantInfo[] | [] {
    if (!this.info) return []
    return this.info.grants.filter((grant) => grant.account === recipient)
  }

  async calculateTotalClaimable() {
    if (this.acceptedGrants.length === 0) return new BigNumber(0)
    const tokenIds = this.acceptedGrants.map((grant) => grant.id)
    const claimableResults = await Promise.all(
      tokenIds.map((id) => {
        return this.communityRewards.contract.methods
          .claimableRewards(id)
          .call()
          .then((res) => new BigNumber(res))
      })
    )
    return BigNumber.sum.apply(null, claimableResults)
  }

  calculateStillVesting(): BigNumber {
    if (this.acceptedGrants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      this.acceptedGrants.map((grant) => grant.totalGranted.minus(grant.totalClaimed))
    )
  }

  calculateGranted(): BigNumber {
    if (this.acceptedGrants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      this.acceptedGrants.map((grant) => grant.totalGranted)
    )
  }
}

interface CommunityRewardsVesting {
  id: string
  user: string
  totalGranted: BigNumber
  totalClaimed: BigNumber
  startTime: string
  endTime: string
  cliffLength: BigNumber
  vestingInterval: BigNumber
  revokedAt: BigNumber
}

function parseCommunityRewardsVesting(
  tokenId: string,
  user: string,
  tuple: {
    0: string
    1: string
    2: string
    3: string
    4: string
    5: string
    6: string
  }
): CommunityRewardsVesting {
  return {
    id: tokenId,
    user: user,
    totalGranted: new BigNumber(tuple[0]),
    totalClaimed: new BigNumber(tuple[1]),
    startTime: tuple[2],
    endTime: tuple[3],
    cliffLength: new BigNumber(tuple[4]),
    vestingInterval: new BigNumber(tuple[5]),
    revokedAt: new BigNumber(tuple[6]),
  }
}

export class CommunityRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: CommunityRewardsContract
  address: string
  _loaded: boolean
  grants: CommunityRewardsVesting[]

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<CommunityRewardsContract>("CommunityRewards")
    this.address = goldfinchProtocol.getAddress("CommunityRewards")
    this.grants = []
    this._loaded = false
  }

  async initialize(recipient: string) {
    const events = await this.getGrantedEvents(recipient)
    const tokenIds = events.map((e) => e.returnValues.tokenId)
    this.grants = await Promise.all(
      tokenIds.map((tokenId) => {
        return this.contract.methods
          .grants(tokenId)
          .call()
          .then((res) => parseCommunityRewardsVesting(tokenId, recipient, res))
      })
    )
    this._loaded = true
  }

  // can use this to get accepted grants
  async getGrantedEvents(recipient: string): Promise<EventData[]> {
    const eventNames = ["Granted"]
    const events = await this.goldfinchProtocol.queryEvents(this.contract, eventNames, {user: recipient})
    return events
  }
}

export type {CommunityRewardsVesting}

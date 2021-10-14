import {EventData} from "web3-eth-contract"
import {MerkleDistributor as MerkleDistributorContract} from "@goldfinch-eng/protocol/typechain/web3/MerkleDistributor"
import {CommunityRewards as CommunityRewardsContract} from "@goldfinch-eng/protocol/typechain/web3/CommunityRewards"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkleDistributor/types"
import BigNumber from "bignumber.js"
import {getBlockInfo, getCurrentBlock} from "../utils"
import {getMerkleDistributorInfo} from "./utils"

export class MerkleDistributor {
  goldfinchProtocol: GoldfinchProtocol
  contract: MerkleDistributorContract
  address: string
  _loaded: boolean
  info: MerkleDistributorInfo | undefined
  communityRewards: CommunityRewards
  actionRequiredAirdrops: MerkleDistributorGrantInfo[] | undefined
  totalClaimable: BigNumber | undefined
  unvested: BigNumber | undefined
  granted: BigNumber | undefined

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<MerkleDistributorContract>("MerkleDistributor")
    this.address = goldfinchProtocol.getAddress("MerkleDistributor")
    this.communityRewards = new CommunityRewards(goldfinchProtocol)
    this._loaded = true
  }

  async initialize(recipient: string) {
    const contractAddress = await this.contract.methods.communityRewards().call()
    if (contractAddress !== this.communityRewards.address) {
      throw new Error(
        "MerkleDistributor community rewards address doesn't match with deployed CommunityRewards address"
      )
    }

    const info = await getMerkleDistributorInfo()
    if (!info) return
    this.info = info

    await this.communityRewards.initialize(recipient)
    this.totalClaimable = this.calculateTotalClaimable()
    this.unvested = this.calculateUnvested()
    this.granted = this.calculateGranted()

    this.actionRequiredAirdrops = await this.getActionRequiredAirdrops(recipient)

    if (this.communityRewards.grants) {
      for (let acceptedGrant of this.communityRewards.grants) {
        const airdrop = this.getGrantsInfo(recipient).find(
          (airdrop) =>
            airdrop.account === acceptedGrant.user &&
            new BigNumber(airdrop.grant.amount) === acceptedGrant.rewards.totalGranted &&
            new BigNumber(airdrop.grant.cliffLength) === acceptedGrant.rewards.cliffLength &&
            new BigNumber(airdrop.grant.vestingInterval) === acceptedGrant.rewards.vestingInterval &&
            Number(airdrop.grant.vestingLength) ===
              Number(acceptedGrant.rewards.endTime) - Number(acceptedGrant.rewards.startTime)
        )
        acceptedGrant._reason = airdrop?.reason
      }
    }
    this._loaded = true
  }

  getGrantsInfo(recipient: string): MerkleDistributorGrantInfo[] {
    if (!this.info) return []
    return this.info.grants.filter((grant) => grant.account === recipient)
  }

  async getGrantsAccepted(recipient: string) {
    if (!this.info) return []
    return await this.goldfinchProtocol.queryEvents(this.contract, ["GrantAccepted"], {
      account: recipient,
    })
  }

  async getActionRequiredAirdrops(recipient: string) {
    const airdrops = this.getGrantsInfo(recipient)
    const acceptedAirdropsEvents = await this.getGrantsAccepted(recipient)

    return airdrops.filter((airdrop) => !acceptedAirdropsEvents.find((e) => e.returnValues.index === airdrop.index))
  }

  calculateTotalClaimable(): BigNumber {
    if (!this.communityRewards.grants || this.communityRewards.grants.length === 0) return new BigNumber(0)
    const claimableResults = this.communityRewards.grants.map((grant) => grant.claimable)
    return BigNumber.sum.apply(null, claimableResults)
  }

  calculateUnvested(): BigNumber {
    if (!this.communityRewards.grants || this.communityRewards.grants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      this.communityRewards.grants.map((grant) =>
        grant.rewards.totalGranted.minus(grant.rewards.totalClaimed.plus(grant.claimable))
      )
    )
  }

  calculateGranted(): BigNumber {
    if (!this.communityRewards.grants || this.communityRewards.grants.length === 0) return new BigNumber(0)
    return BigNumber.sum.apply(
      null,
      this.communityRewards.grants.map((grant) => grant.rewards.totalGranted)
    )
  }
}

interface Rewards {
  totalGranted: BigNumber
  totalClaimed: BigNumber
  startTime: string
  endTime: string
  cliffLength: BigNumber
  vestingInterval: BigNumber
  revokedAt: BigNumber
}

export class CommunityRewardsVesting {
  id: string
  user: string
  claimable: BigNumber
  rewards: Rewards
  _reason?: string

  constructor(id: string, user: string, claimable: BigNumber, rewards: Rewards) {
    this.id = id
    this.user = user
    this.rewards = rewards
    this.claimable = claimable
  }

  reason(): string {
    return !this._reason ? "Community Rewards" : this._reason
  }

  granted(): BigNumber {
    return this.rewards.totalGranted
  }
}

function parseCommunityRewardsVesting(
  tokenId: string,
  user: string,
  claimable: string,
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
  return new CommunityRewardsVesting(tokenId, user, new BigNumber(claimable), {
    totalGranted: new BigNumber(tuple[0]),
    totalClaimed: new BigNumber(tuple[1]),
    startTime: tuple[2],
    endTime: tuple[3],
    cliffLength: new BigNumber(tuple[4]),
    vestingInterval: new BigNumber(tuple[5]),
    revokedAt: new BigNumber(tuple[6]),
  })
}

export class CommunityRewards {
  goldfinchProtocol: GoldfinchProtocol
  contract: CommunityRewardsContract
  address: string
  _loaded: boolean
  grants: CommunityRewardsVesting[] | undefined

  constructor(goldfinchProtocol: GoldfinchProtocol) {
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = goldfinchProtocol.getContract<CommunityRewardsContract>("CommunityRewards")
    this.address = goldfinchProtocol.getAddress("CommunityRewards")
    this._loaded = false
  }

  async initialize(recipient: string) {
    const events = await this.getGrantedEvents(recipient)
    const tokenIds = events.map((e) => e.returnValues.tokenId)
    const currentBlock = getBlockInfo(await getCurrentBlock())
    this.grants = await Promise.all(
      tokenIds.map((tokenId) => {
        return this.contract.methods
          .grants(tokenId)
          .call(undefined, currentBlock.number)
          .then(async (res) => {
            const claimable = await this.contract.methods.claimableRewards(tokenId).call(undefined, currentBlock.number)
            return parseCommunityRewardsVesting(tokenId, recipient, claimable, res)
          })
      })
    )
    this._loaded = true
  }

  async getGrantedEvents(recipient: string): Promise<EventData[]> {
    const eventNames = ["Granted"]
    const events = await this.goldfinchProtocol.queryEvents(this.contract, eventNames, {user: recipient})
    return events
  }
}

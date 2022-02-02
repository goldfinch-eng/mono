import {
  MerkleDirectDistributorGrantInfo,
  MerkleDirectDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDirectDistributor/types"
import {
  MerkleDistributorGrantInfo,
  MerkleDistributorInfo,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import {Go} from "@goldfinch-eng/protocol/typechain/web3/Go"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/web3/UniqueIdentity"
import {assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {EventData} from "web3-eth-contract"
import {
  ApprovalEventType,
  APPROVAL_EVENT,
  APPROVAL_EVENT_TYPES,
  CommunityRewardsEventType,
  COMMUNITY_REWARDS_EVENT_TYPES,
  CreditDeskEventType,
  CREDIT_DESK_EVENT_TYPES,
  DEPOSITED_AND_STAKED_EVENT,
  DEPOSIT_MADE_EVENT,
  DRAWDOWN_MADE_EVENT,
  GRANT_ACCEPTED_EVENT,
  KnownEventData,
  MerkleDirectDistributorEventType,
  MerkleDistributorEventType,
  MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES,
  MERKLE_DISTRIBUTOR_EVENT_TYPES,
  PAYMENT_COLLECTED_EVENT,
  PoolEventType,
  POOL_EVENT_TYPES,
  REWARD_PAID_EVENT,
  STAKED_EVENT,
  StakingRewardsEventType,
  STAKING_REWARDS_EVENT_TYPES,
  UNSTAKED_AND_WITHDREW_EVENT,
  UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT,
  UNSTAKED_EVENT,
  WITHDRAWAL_MADE_EVENT,
} from "../types/events"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../types/loadable"
import {
  AcceptedMerkleDirectDistributorGrant,
  NotAcceptedMerkleDirectDistributorGrant,
} from "../types/merkleDirectDistributor"
import {AcceptedMerkleDistributorGrant, NotAcceptedMerkleDistributorGrant} from "../types/merkleDistributor"
import {
  ACCEPT_TX_TYPE,
  BORROW_TX_TYPE,
  CLAIM_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  HistoricalTx,
  PAYMENT_TX_TYPE,
  STAKE_TX_TYPE,
  SUPPLY_AND_STAKE_TX_TYPE,
  SUPPLY_TX_TYPE,
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  UNSTAKE_TX_NAME,
  USDC_APPROVAL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
} from "../types/transactions"
import {Web3IO} from "../types/web3"
import {assertNonNullable, BlockInfo, defaultSum, WithCurrentBlock} from "../utils"
import {BorrowerInterface, getBorrowerContract} from "./borrower"
import {CommunityRewardsGrant, CommunityRewardsLoaded} from "./communityRewards"
import {ERC20, Tickers, USDC, usdcFromAtomic} from "./erc20"
import {getBalanceAsOf, getPoolEventAmount, mapEventsToTx, populateDates} from "./events"
import {GFILoaded} from "./gfi"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import {BackerMerkleDirectDistributorLoaded, MerkleDirectDistributorLoaded} from "./merkleDirectDistributor"
import {BackerMerkleDistributorLoaded, MerkleDistributorLoaded} from "./merkleDistributor"
import {SeniorPoolLoaded, StakingRewardsLoaded, StakingRewardsPosition, StoredPosition} from "./pool"
import {
  getBackerMerkleDirectDistributorInfo,
  getBackerMerkleDistributorInfo,
  getFromBlock,
  getMerkleDirectDistributorInfo,
  getMerkleDistributorInfo,
} from "./utils"

export const UNLOCK_THRESHOLD = new BigNumber(10000)

export async function getUserData(
  address: string,
  goldfinchProtocol: GoldfinchProtocol,
  pool: SeniorPoolLoaded,
  creditDesk: Web3IO<CreditDesk>,
  networkId: string,
  stakingRewards: StakingRewardsLoaded,
  gfi: GFILoaded,
  communityRewards: CommunityRewardsLoaded,
  merkleDistributor: MerkleDistributorLoaded,
  merkleDirectDistributor: MerkleDirectDistributorLoaded,
  currentBlock: BlockInfo
): Promise<UserLoaded> {
  const borrower = await getBorrowerContract(address, goldfinchProtocol, currentBlock)

  const user = new User(address, networkId, creditDesk, goldfinchProtocol, borrower)
  await user.initialize(
    pool,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    currentBlock
  )
  assertWithLoadedInfo(user)
  return user
}

export interface UnlockedStatus {
  unlockAddress: string
  isUnlocked: boolean
}

type UserStakingRewardsLoadedInfo = {
  currentBlock: BlockInfo
  positions: StakingRewardsPosition[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

class UserStakingRewards {
  info: Loadable<UserStakingRewardsLoadedInfo>

  constructor() {
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    address: string,
    stakingRewards: StakingRewardsLoaded,
    stakedEvents: WithCurrentBlock<{value: KnownEventData<typeof STAKED_EVENT>[]}>,
    currentBlock: BlockInfo
  ): Promise<void> {
    // NOTE: In defining `positions`, we want to use `balanceOf()` plus `tokenOfOwnerByIndex()`
    // to determine `tokenIds`, rather than using the set of Staked events for the `recipient`.
    // The former approach reflects any token transfers that may have occurred to or from the
    // `recipient`, whereas the latter does not.
    const positions = await stakingRewards.contract.readOnly.methods
      .balanceOf(address)
      .call(undefined, currentBlock.number)
      .then((balance: string) => {
        const numPositions = parseInt(balance, 10)
        return numPositions
      })
      .then((numPositions: number) =>
        Promise.all(
          Array(numPositions)
            .fill("")
            .map((val, i) =>
              stakingRewards.contract.readOnly.methods
                .tokenOfOwnerByIndex(address, i)
                .call(undefined, currentBlock.number)
            )
        )
      )
      .then((tokenIds: string[]) =>
        Promise.all([
          tokenIds,
          Promise.all(
            tokenIds.map((tokenId) =>
              stakingRewards.contract.readOnly.methods
                .positions(tokenId)
                .call(undefined, currentBlock.number)
                .then(async (rawPosition) => {
                  const storedPosition = UserStakingRewards.parseStoredPosition(rawPosition)
                  const optimisticIncrement = await stakingRewards.calculatePositionOptimisticIncrement(
                    tokenId,
                    storedPosition.rewards,
                    currentBlock
                  )
                  return {storedPosition, optimisticIncrement}
                })
            )
          ),
          Promise.all(
            tokenIds.map(async (tokenId) => {
              const stakedEvent = stakedEvents.value.find(
                (stakedEvent: KnownEventData<typeof STAKED_EVENT>) => stakedEvent.returnValues.tokenId === tokenId
              )
              if (!stakedEvent) {
                throw new Error(
                  `Failed to retrieve Staked event for tokenId ${tokenId}, from set for token ids: ${stakedEvents.value.map(
                    (stakedEvent: KnownEventData<typeof STAKED_EVENT>) => stakedEvent.returnValues.tokenId
                  )}`
                )
              }
              return stakedEvent
            })
          ),
          Promise.all(
            tokenIds.map((tokenId) =>
              stakingRewards.contract.readOnly.methods
                .positionCurrentEarnRate(tokenId)
                .call(undefined, currentBlock.number)
            )
          ),
        ])
      )
      .then(([tokenIds, storedAndIncrements, correspondingStakedEvents, currentEarnRates]) => {
        return tokenIds.map((tokenId, i) => {
          const storedAndIncrement = storedAndIncrements[i]
          assertNonNullable(storedAndIncrement)
          const {storedPosition, optimisticIncrement} = storedAndIncrement
          const stakedEvent = correspondingStakedEvents[i]
          assertNonNullable(stakedEvent)
          const currentEarnRate = currentEarnRates[i]
          assertNonNullable(currentEarnRate)
          return new StakingRewardsPosition(
            tokenId,
            stakedEvent,
            new BigNumber(currentEarnRate),
            storedPosition,
            optimisticIncrement
          )
        })
      })

    const claimable = UserStakingRewards.calculateClaimableRewards(positions)
    const unvested = UserStakingRewards.calculateUnvestedRewards(positions)
    const granted = UserStakingRewards.calculateGrantedRewards(positions)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        positions,
        claimable,
        unvested,
        granted,
      },
    }
  }

  get lockedPositions(): StakingRewardsPosition[] {
    // We expect this getter to be used only once info has been loaded.
    assertWithLoadedInfo(this)
    const value = this.info.value
    return value.positions.filter((position) => position.getLocked(value.currentBlock))
  }

  get unlockedPositions(): StakingRewardsPosition[] {
    // We expect this getter to be used only once info has been loaded.
    assertWithLoadedInfo(this)
    const value = this.info.value
    return value.positions.filter((position) => !position.getLocked(value.currentBlock))
  }

  get unvestedRewardsPositions(): StakingRewardsPosition[] {
    assertWithLoadedInfo(this)
    const value = this.info.value
    return value.positions.filter((position) => position.storedPosition.rewards.endTime > value.currentBlock.timestamp)
  }

  static calculateClaimableRewards(positions: StakingRewardsPosition[]): BigNumber {
    return defaultSum(positions.map((position) => position.claimable))
  }

  static calculateUnvestedRewards(positions: StakingRewardsPosition[]): BigNumber {
    return defaultSum(positions.map((position) => position.unvested))
  }

  static calculateGrantedRewards(positions: StakingRewardsPosition[]): BigNumber {
    return defaultSum(positions.map((position) => position.granted))
  }

  static parseStoredPosition(tuple: {
    0: string
    1: [string, string, string, string, string, string]
    2: string
    3: string
  }): StoredPosition {
    return {
      amount: new BigNumber(tuple[0]),
      rewards: {
        totalUnvested: new BigNumber(tuple[1][0]),
        totalVested: new BigNumber(tuple[1][1]),
        totalPreviouslyVested: new BigNumber(tuple[1][2]),
        totalClaimed: new BigNumber(tuple[1][3]),
        startTime: parseInt(tuple[1][4], 10),
        endTime: parseInt(tuple[1][5], 10),
      },
      leverageMultiplier: new BigNumber(tuple[2]),
      lockedUntil: parseInt(tuple[3], 10),
    }
  }
}

export type UserStakingRewardsLoaded = WithLoadedInfo<UserStakingRewards, UserStakingRewardsLoadedInfo>

type UserCommunityRewardsLoadedInfo = {
  currentBlock: BlockInfo
  grants: CommunityRewardsGrant[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

export class UserCommunityRewards {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserCommunityRewardsLoadedInfo>

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    userMerkleDistributor: UserMerkleDistributorLoaded,
    userBackerMerkleDistributor: UserBackerMerkleDistributorLoaded,
    currentBlock: BlockInfo
  ): Promise<void> {
    // NOTE: In defining `grants`, we want to use `balanceOf()` plus `tokenOfOwnerByIndex`
    // to determine `tokenIds`, rather than using the set of Granted events for the `recipient`.
    // The former approach reflects any token transfers that may have occurred to or from the
    // `recipient`, whereas the latter does not.
    const grants = await communityRewards.contract.readOnly.methods
      .balanceOf(this.address)
      .call(undefined, currentBlock.number)
      .then((balance: string) => parseInt(balance, 10))
      .then((numPositions: number) =>
        Promise.all(
          Array(numPositions)
            .fill("")
            .map((val, i) =>
              communityRewards.contract.readOnly.methods
                .tokenOfOwnerByIndex(this.address, i)
                .call(undefined, currentBlock.number)
            )
        )
      )
      .then((tokenIds: string[]) =>
        Promise.all([
          tokenIds,
          Promise.all(
            tokenIds.map((tokenId) =>
              communityRewards.contract.readOnly.methods.grants(tokenId).call(undefined, currentBlock.number)
            )
          ),
          Promise.all(
            tokenIds.map((tokenId) =>
              communityRewards.contract.readOnly.methods.claimableRewards(tokenId).call(undefined, currentBlock.number)
            )
          ),
          Promise.all(
            tokenIds.map(async (tokenId) => {
              const {events, userDistributor} = await this.getAcceptedEventsForMerkleDistributorScenarios(
                merkleDistributor,
                backerMerkleDistributor,
                tokenId,
                currentBlock,
                userMerkleDistributor,
                userBackerMerkleDistributor
              )

              if (events.length === 1) {
                const acceptanceEvent = events[0]
                assertNonNullable(acceptanceEvent)
                const airdrop = userDistributor.info.value.airdrops.accepted.find(
                  (airdrop) => parseInt(acceptanceEvent.returnValues.index, 10) === airdrop.grantInfo.index
                )
                if (airdrop) {
                  return {
                    event: acceptanceEvent,
                    airdropGrantInfo: airdrop.grantInfo,
                  }
                } else {
                  throw new Error(
                    `Failed to identify airdrop corresponding to GrantAccepted event ${tokenId}, among user's accepted airdrops.`
                  )
                }
              } else if (events.length === 0) {
                // This is not necessarily an error, because in theory it's possible the grant was accepted
                // not via the `MerkleDistributor.acceptGrant()`, but instead by having been issued directly
                // via `CommunityRewards.grant()`.
                console.warn(
                  `Failed to identify GrantAccepted event corresponding to CommunityRewards grant ${tokenId}.`
                )
                return
              } else {
                throw new Error(
                  `Identified more than one GrantAccepted event corresponding to CommunityRewards grant ${tokenId}.`
                )
              }
            })
          ),
        ])
      )
      .then(([tokenIds, rawGrants, claimables, acceptEventInfos]) =>
        tokenIds.map((tokenId, i): CommunityRewardsGrant => {
          const rawGrant = rawGrants[i]
          assertNonNullable(rawGrant)
          const claimable = claimables[i]
          assertNonNullable(claimable)
          const grantInfo = acceptEventInfos[i]?.airdropGrantInfo
          const acceptEvent = acceptEventInfos[i]?.event
          assertNonNullable(acceptEvent)
          return UserCommunityRewards.parseCommunityRewardsGrant(
            tokenId,
            new BigNumber(claimable),
            rawGrant,
            grantInfo,
            acceptEvent
          )
        })
      )

    const claimable = UserCommunityRewards.calculateClaimable(grants)
    const unvested = UserCommunityRewards.calculateUnvested(grants)
    const granted = UserCommunityRewards.calculateGranted(grants)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        grants,
        claimable,
        unvested,
        granted,
      },
    }
  }

  private async getAcceptedEventsForMerkleDistributorScenarios(
    merkleDistributor: MerkleDistributorLoaded,
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    tokenId: string,
    currentBlock: BlockInfo,
    userMerkleDistributor: UserMerkleDistributorLoaded,
    userBackerMerkleDistributor: UserBackerMerkleDistributorLoaded
  ): Promise<{
    events: EventData[]
    userDistributor: UserMerkleDistributorLoaded | UserBackerMerkleDistributorLoaded
  }> {
    let events: EventData[], userDistributor: UserMerkleDistributorLoaded | UserBackerMerkleDistributorLoaded
    events = await this.goldfinchProtocol.queryEvents(
      merkleDistributor.contract.readOnly,
      [GRANT_ACCEPTED_EVENT],
      {tokenId, account: this.address},
      currentBlock.number
    )
    userDistributor = userMerkleDistributor

    if (events.length === 0) {
      events = await this.goldfinchProtocol.queryEvents(
        backerMerkleDistributor.contract.readOnly,
        [GRANT_ACCEPTED_EVENT],
        {tokenId, account: this.address},
        currentBlock.number
      )
      userDistributor = userBackerMerkleDistributor
    }
    return {events, userDistributor}
  }

  static calculateClaimable(grants: CommunityRewardsGrant[]): BigNumber {
    return defaultSum(grants.map((grant) => grant.claimable))
  }

  static calculateUnvested(grants: CommunityRewardsGrant[]): BigNumber {
    return defaultSum(grants.map((grant) => grant.unvested))
  }

  static calculateGranted(grants: CommunityRewardsGrant[]): BigNumber {
    return defaultSum(grants.map((grant) => grant.granted))
  }

  static parseCommunityRewardsGrant(
    tokenId: string,
    claimable: BigNumber,
    tuple: {
      0: string
      1: string
      2: string
      3: string
      4: string
      5: string
      6: string
    },
    grantInfo: MerkleDistributorGrantInfo | undefined,
    acceptEvent: EventData
  ): CommunityRewardsGrant {
    return new CommunityRewardsGrant(
      tokenId,
      claimable,
      {
        totalGranted: new BigNumber(tuple[0]),
        totalClaimed: new BigNumber(tuple[1]),
        startTime: parseInt(tuple[2], 10),
        endTime: parseInt(tuple[3], 10),
        cliffLength: new BigNumber(tuple[4]),
        vestingInterval: new BigNumber(tuple[5]),
        revokedAt: parseInt(tuple[6], 10),
      },
      grantInfo,
      acceptEvent
    )
  }
}

export type UserCommunityRewardsLoaded = WithLoadedInfo<UserCommunityRewards, UserCommunityRewardsLoadedInfo>

type UserMerkleDistributorLoadedInfo = {
  currentBlock: BlockInfo
  merkleDistributorInfo: MerkleDistributorInfo
  airdrops: {
    accepted: AcceptedMerkleDistributorGrant[]
    notAccepted: NotAcceptedMerkleDistributorGrant[]
  }
  notAcceptedClaimable: BigNumber
  notAcceptedUnvested: BigNumber
}

export class UserMerkleDistributor {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserMerkleDistributorLoadedInfo>

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async getMerkleInfo(): Promise<MerkleDistributorInfo | undefined> {
    return await getMerkleDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return await UserMerkleDistributor.getAirdropsWithAcceptance(airdropsForRecipient, merkleDistributor, currentBlock)
  }

  async initialize(
    merkleDistributor: MerkleDistributorLoaded | BackerMerkleDistributorLoaded,
    communityRewards: CommunityRewardsLoaded,
    currentBlock: BlockInfo
  ): Promise<void> {
    const merkleDistributorInfo = await this.getMerkleInfo()
    if (!merkleDistributorInfo) {
      throw new Error("Failed to retrieve MerkleDistributor info.")
    }

    const airdropsForRecipient = UserMerkleDistributor.getAirdropsForRecipient(
      merkleDistributorInfo.grants,
      this.address
    )
    const [withAcceptance, _tokenLaunchTime] = await Promise.all([
      this._getAirdropsWithAcceptance(airdropsForRecipient, merkleDistributor, currentBlock),
      communityRewards.contract.readOnly.methods.tokenLaunchTimeInSeconds().call(undefined, currentBlock.number),
    ])
    const tokenLaunchTime = new BigNumber(_tokenLaunchTime)
    const airdrops = withAcceptance.reduce<{
      accepted: MerkleDistributorGrantInfo[]
      notAccepted: MerkleDistributorGrantInfo[]
    }>(
      (acc, curr) => {
        if (curr.isAccepted) {
          acc.accepted.push(curr.grantInfo)
        } else {
          acc.notAccepted.push(curr.grantInfo)
        }
        return acc
      },
      {accepted: [], notAccepted: []}
    )
    const accepted = airdrops.accepted.map(
      (grantInfo): AcceptedMerkleDistributorGrant => ({
        accepted: true,
        grantInfo,
        granted: undefined,
        vested: undefined,
        claimable: undefined,
        unvested: undefined,
      })
    )
    const notAccepted = await Promise.all(
      airdrops.notAccepted.map(async (grantInfo): Promise<NotAcceptedMerkleDistributorGrant> => {
        const granted = new BigNumber(grantInfo.grant.amount)
        const optimisticVested = new BigNumber(
          await communityRewards.contract.readOnly.methods
            .totalVestedAt(
              tokenLaunchTime.toString(10),
              tokenLaunchTime.plus(new BigNumber(grantInfo.grant.vestingLength)).toString(10),
              new BigNumber(grantInfo.grant.amount).toString(10),
              new BigNumber(grantInfo.grant.cliffLength).toString(10),
              new BigNumber(grantInfo.grant.vestingInterval).toString(10),
              0,
              currentBlock.timestamp
            )
            .call(undefined, currentBlock.number)
        )
        const vested = optimisticVested
        return {
          accepted: false,
          grantInfo,
          granted,
          vested,
          claimable: vested,
          unvested: granted.minus(vested),
        }
      })
    )

    const notAcceptedClaimable = defaultSum(notAccepted.map((val) => val.claimable))

    const notAcceptedUnvested = defaultSum(notAccepted.map((val) => val.unvested))

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDistributorInfo,
        airdrops: {
          accepted,
          notAccepted,
        },
        notAcceptedClaimable,
        notAcceptedUnvested,
      },
    }
  }

  static async getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return Promise.all(
      airdropsForRecipient.map(async (grantInfo) => ({
        grantInfo,
        isAccepted: await merkleDistributor.contract.readOnly.methods
          .isGrantAccepted(grantInfo.index)
          .call(undefined, currentBlock.number),
      }))
    )
  }

  static getAirdropsForRecipient(
    allAirdrops: MerkleDistributorGrantInfo[],
    recipient: string
  ): MerkleDistributorGrantInfo[] {
    return allAirdrops.filter((grantInfo) => grantInfo.account.toLowerCase() === recipient.toLowerCase())
  }
}

export class UserBackerMerkleDistributor extends UserMerkleDistributor {
  async getMerkleInfo(): Promise<MerkleDistributorInfo | undefined> {
    return await getBackerMerkleDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return await UserBackerMerkleDistributor.getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDistributor,
      currentBlock
    )
  }
}

export type UserMerkleDistributorLoaded = WithLoadedInfo<UserMerkleDistributor, UserMerkleDistributorLoadedInfo>

export type UserBackerMerkleDistributorLoaded = WithLoadedInfo<
  UserBackerMerkleDistributor,
  UserMerkleDistributorLoadedInfo
>

type UserMerkleDirectDistributorLoadedInfo = {
  currentBlock: BlockInfo
  merkleDirectDistributorInfo: MerkleDirectDistributorInfo
  airdrops: {
    accepted: AcceptedMerkleDirectDistributorGrant[]
    notAccepted: NotAcceptedMerkleDirectDistributorGrant[]
  }
  claimable: BigNumber
  unvested: BigNumber
}

export class UserMerkleDirectDistributor {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserMerkleDirectDistributorLoadedInfo>

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async getMerkleInfo(): Promise<MerkleDirectDistributorInfo | undefined> {
    return await getMerkleDirectDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return await UserMerkleDirectDistributor.getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDirectDistributor,
      currentBlock
    )
  }

  async initialize(
    merkleDirectDistributor: MerkleDirectDistributorLoaded | BackerMerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ): Promise<void> {
    const merkleDirectDistributorInfo = await this.getMerkleInfo()
    if (!merkleDirectDistributorInfo) {
      throw new Error("Failed to retrieve MerkleDirectDistributor info.")
    }

    const airdropsForRecipient = UserMerkleDirectDistributor.getAirdropsForRecipient(
      merkleDirectDistributorInfo.grants,
      this.address
    )
    const withAcceptance = await this._getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDirectDistributor,
      currentBlock
    )
    const airdrops = withAcceptance.reduce<{
      accepted: MerkleDirectDistributorGrantInfo[]
      notAccepted: MerkleDirectDistributorGrantInfo[]
    }>(
      (acc, curr) => {
        if (curr.isAccepted) {
          acc.accepted.push(curr.grantInfo)
        } else {
          acc.notAccepted.push(curr.grantInfo)
        }
        return acc
      },
      {accepted: [], notAccepted: []}
    )

    const accepted = airdrops.accepted.map((grantInfo): AcceptedMerkleDirectDistributorGrant => {
      const granted = new BigNumber(grantInfo.grant.amount)
      const vested = granted
      return {
        accepted: true,
        grantInfo,
        granted,
        vested,
        // Direct grants that have been accepted have no further claimable amount.
        claimable: new BigNumber(0),
        unvested: granted.minus(vested),
      }
    })

    accepted.forEach(async (grant: AcceptedMerkleDirectDistributorGrant) => {
      const events = await this.goldfinchProtocol.queryEvents(
        merkleDirectDistributor.contract.readOnly,
        [GRANT_ACCEPTED_EVENT],
        {index: grant.grantInfo.index.toString()},
        currentBlock.number
      )
      if (events.length === 1) {
        const acceptanceEvent = events[0]
        assertNonNullable(acceptanceEvent)
        grant.acceptEvent = acceptanceEvent
      } else if (events.length === 0) {
        console.warn(
          `Failed to identify GrantAccepted event corresponding to Merkle Direct Distributor grant ${grant.grantInfo.index}.`
        )
      } else {
        throw new Error(
          `Identified more than one GrantAccepted event corresponding to Merkle Direct Distributor grant ${grant.grantInfo.index}.`
        )
      }
      return
    })

    const notAccepted = airdrops.notAccepted.map((grantInfo): NotAcceptedMerkleDirectDistributorGrant => {
      const granted = new BigNumber(grantInfo.grant.amount)
      const vested = granted
      return {
        accepted: false,
        grantInfo,
        granted,
        vested,
        claimable: vested,
        unvested: granted.minus(vested),
      }
    })

    const acceptedClaimable = defaultSum(accepted.map((val) => val.claimable))
    const notAcceptedClaimable = defaultSum(notAccepted.map((val) => val.claimable))
    const claimable = acceptedClaimable.plus(notAcceptedClaimable)

    const acceptedUnvested = defaultSum(accepted.map((val) => val.unvested))
    const notAcceptedUnvested = defaultSum(notAccepted.map((val) => val.unvested))
    const unvested = acceptedUnvested.plus(notAcceptedUnvested)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        merkleDirectDistributorInfo,
        airdrops: {
          accepted,
          notAccepted,
        },
        claimable,
        unvested,
      },
    }
  }

  static async getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return Promise.all(
      airdropsForRecipient.map(async (grantInfo) => ({
        grantInfo,
        isAccepted: await merkleDirectDistributor.contract.readOnly.methods
          .isGrantAccepted(grantInfo.index)
          .call(undefined, currentBlock.number),
      }))
    )
  }

  static getAirdropsForRecipient(
    allAirdrops: MerkleDirectDistributorGrantInfo[],
    recipient: string
  ): MerkleDirectDistributorGrantInfo[] {
    return allAirdrops.filter((grantInfo) => grantInfo.account.toLowerCase() === recipient.toLowerCase())
  }
}

export class UserBackerMerkleDirectDistributor extends UserMerkleDirectDistributor {
  async getMerkleInfo(): Promise<MerkleDirectDistributorInfo | undefined> {
    return await getBackerMerkleDirectDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return await UserBackerMerkleDirectDistributor.getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDirectDistributor,
      currentBlock
    )
  }
}

export type UserMerkleDirectDistributorLoaded = WithLoadedInfo<
  UserMerkleDirectDistributor,
  UserMerkleDirectDistributorLoadedInfo
>

export type UserBackerMerkleDirectDistributorLoaded = WithLoadedInfo<
  UserBackerMerkleDirectDistributor,
  UserMerkleDirectDistributorLoadedInfo
>

export type UserLoadedInfo = {
  currentBlock: BlockInfo
  usdcBalance: BigNumber
  usdcBalanceInDollars: BigNumber
  poolAllowance: BigNumber
  poolEvents: KnownEventData<PoolEventType>[]
  pastTxs: HistoricalTx<
    | ApprovalEventType
    | CreditDeskEventType
    | PoolEventType
    | StakingRewardsEventType
    | CommunityRewardsEventType
    | MerkleDistributorEventType
    | MerkleDirectDistributorEventType
  >[]
  poolTxs: HistoricalTx<PoolEventType>[]
  goListed: boolean
  legacyGolisted: boolean
  hasUID: boolean
  gfiBalance: BigNumber
  usdcIsUnlocked: {
    earn: {
      unlockAddress: string
      isUnlocked: boolean
    }
    borrow: {
      unlockAddress: string
      isUnlocked: boolean
    }
  }
  stakingRewards: UserStakingRewardsLoaded
}

export type UserLoaded = WithLoadedInfo<User, UserLoadedInfo>

export class User {
  address: string
  networkId: string
  borrower: BorrowerInterface | undefined
  info: Loadable<UserLoadedInfo>

  goldfinchProtocol: GoldfinchProtocol

  private creditDesk: Web3IO<CreditDesk>

  constructor(
    address: string,
    networkId: string,
    creditDesk: Web3IO<CreditDesk>,
    goldfinchProtocol: GoldfinchProtocol,
    borrower: BorrowerInterface | undefined
  ) {
    if (!address) {
      throw new Error("User must have an address.")
    }
    this.address = address
    this.networkId = networkId
    this.borrower = borrower
    this.goldfinchProtocol = goldfinchProtocol
    this.creditDesk = creditDesk
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    gfi: GFILoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    const usdc = this.goldfinchProtocol.getERC20(Tickers.USDC)

    const usdcBalance = await usdc.getBalance(this.address, currentBlock)
    const usdcBalanceInDollars = new BigNumber(usdcFromAtomic(usdcBalance))
    const poolAllowance = await usdc.getAllowance({owner: this.address, spender: pool.address}, currentBlock)

    const [
      usdcTxs,
      fiduTxs,
      poolEventsAndTxs,
      creditDeskTxs,
      stakingRewardsEventsAndTxs,
      communityRewardsTxs,
      merkleDistributorTxs,
      merkleDirectDistributorTxs,
    ] = await this._fetchTxs(
      usdc,
      pool,
      stakingRewards,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      currentBlock
    )
    const {poolEvents, poolTxs} = poolEventsAndTxs
    const {stakedEvents, stakingRewardsTxs} = stakingRewardsEventsAndTxs
    let pastTxs = _.reverse(
      _.sortBy(
        [
          ...usdcTxs,
          ...fiduTxs,
          ...poolTxs,
          ...creditDeskTxs,
          ...stakingRewardsTxs,
          ...communityRewardsTxs,
          ...merkleDistributorTxs,
          ...merkleDirectDistributorTxs,
        ],
        ["blockNumber", "transactionIndex"]
      )
    )
    pastTxs = await populateDates(pastTxs)

    const golistStatus = await this._fetchGolistStatus(this.address, currentBlock)
    const goListed = golistStatus.golisted
    const legacyGolisted = golistStatus.legacyGolisted
    const hasUID = golistStatus.hasUID

    const gfiBalance = new BigNumber(
      await gfi.contract.readOnly.methods.balanceOf(this.address).call(undefined, currentBlock.number)
    )

    const userStakingRewards = new UserStakingRewards()
    await userStakingRewards.initialize(this.address, stakingRewards, stakedEvents, currentBlock)
    assertWithLoadedInfo(userStakingRewards)

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        usdcBalance,
        usdcBalanceInDollars,
        poolAllowance,
        poolEvents,
        pastTxs,
        poolTxs,
        goListed,
        legacyGolisted,
        hasUID,
        gfiBalance,
        usdcIsUnlocked: {
          earn: {
            unlockAddress: pool.address,
            isUnlocked: this.isUnlocked(poolAllowance),
          },
          borrow: {
            unlockAddress: this.borrower?.borrowerAddress || this.address,
            isUnlocked: this.borrower?.allowance ? this.isUnlocked(this.borrower.allowance) : false,
          },
        },
        stakingRewards: userStakingRewards,
      },
    }
  }

  async _fetchTxs(
    usdc: ERC20,
    pool: SeniorPoolLoaded,
    stakingRewards: StakingRewardsLoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return Promise.all([
      // NOTE: We have no need to include usdc txs for `pool.v1Pool` among the txs in
      // `this.pastTxs`. So we don't get them. We only need usdc txs for `pool`.
      getAndTransformUSDCEvents(usdc, pool.address, this.address, currentBlock),
      getAndTransformFIDUEvents(this.goldfinchProtocol, this.address, currentBlock),
      getPoolEvents(pool, this.address, currentBlock).then(async (poolEvents) => {
        return {
          poolEvents,
          poolTxs: await mapEventsToTx(poolEvents, POOL_EVENT_TYPES, {
            parseName: (eventData: KnownEventData<PoolEventType>) => {
              switch (eventData.event) {
                case DEPOSIT_MADE_EVENT:
                  return SUPPLY_TX_TYPE
                case WITHDRAWAL_MADE_EVENT:
                  return WITHDRAW_FROM_SENIOR_POOL_TX_TYPE
                default:
                  return assertUnreachable(eventData.event)
              }
            },
            parseAmount: (eventData: KnownEventData<PoolEventType>) => {
              switch (eventData.event) {
                case DEPOSIT_MADE_EVENT: {
                  return {
                    amount: eventData.returnValues.amount,
                    units: "usdc",
                  }
                }
                case WITHDRAWAL_MADE_EVENT: {
                  return {
                    amount: eventData.returnValues.userAmount,
                    units: "usdc",
                  }
                }
                default:
                  return assertUnreachable(eventData.event)
              }
            },
          }),
        }
      }),

      // Credit desk events could've come from the user directly or the borrower contract, we need to filter by both
      getAndTransformCreditDeskEvents(
        this.creditDesk,
        _.compact([this.address, this.borrower?.borrowerAddress]),
        this.goldfinchProtocol.networkId,
        currentBlock
      ),

      getOverlappingStakingRewardsEvents(this.address, stakingRewards).then(async (overlappingStakingRewardsEvents) => {
        const nonOverlappingEvents = getNonOverlappingStakingRewardsEvents(overlappingStakingRewardsEvents.value)
        const stakedEvents: KnownEventData<typeof STAKED_EVENT>[] = overlappingStakingRewardsEvents.value.filter(
          (
            eventData: KnownEventData<StakingRewardsEventType>
          ): eventData is KnownEventData<StakingRewardsEventType> & {event: typeof STAKED_EVENT} =>
            eventData.event === STAKED_EVENT
        )
        return {
          stakedEvents: {
            currentBlock: overlappingStakingRewardsEvents.currentBlock,
            value: stakedEvents,
          },
          stakingRewardsTxs: await mapEventsToTx(nonOverlappingEvents, STAKING_REWARDS_EVENT_TYPES, {
            parseName: (eventData: KnownEventData<StakingRewardsEventType>) => {
              switch (eventData.event) {
                case STAKED_EVENT:
                  return STAKE_TX_TYPE
                case DEPOSITED_AND_STAKED_EVENT:
                  return SUPPLY_AND_STAKE_TX_TYPE
                case UNSTAKED_EVENT:
                  return UNSTAKE_TX_NAME
                case UNSTAKED_AND_WITHDREW_EVENT:
                case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
                  return UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE
                case REWARD_PAID_EVENT:
                  return CLAIM_TX_TYPE
                default:
                  return assertUnreachable(eventData.event)
              }
            },
            parseAmount: (eventData: KnownEventData<StakingRewardsEventType>) => {
              switch (eventData.event) {
                case STAKED_EVENT:
                  return {
                    amount: eventData.returnValues.amount,
                    units: "fidu",
                  }
                case DEPOSITED_AND_STAKED_EVENT:
                  return {
                    amount: eventData.returnValues.depositedAmount,
                    units: "usdc",
                  }
                case UNSTAKED_EVENT:
                  return {
                    amount: eventData.returnValues.amount,
                    units: "fidu",
                  }
                case UNSTAKED_AND_WITHDREW_EVENT:
                case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
                  return {
                    amount: eventData.returnValues.usdcReceivedAmount,
                    units: "usdc",
                  }
                case REWARD_PAID_EVENT:
                  return {
                    amount: eventData.returnValues.reward,
                    units: "gfi",
                  }
                default:
                  return assertUnreachable(eventData.event)
              }
            },
          }),
        }
      }),
      getAndTransformCommunityRewardsEvents(this.address, communityRewards),
      getAndTransformMerkleDistributorEvents(this.address, merkleDistributor),
      getAndTransformMerkleDirectDistributorEvents(this.address, merkleDirectDistributor),
    ])
  }

  isUnlocked(allowance: BigNumber | undefined) {
    return !allowance || allowance.gte(UNLOCK_THRESHOLD)
  }

  async _fetchGolistStatus(address: string, currentBlock: BlockInfo) {
    const config = this.goldfinchProtocol.getContract<GoldfinchConfig>("GoldfinchConfig")
    const legacyGolisted = await config.readOnly.methods.goList(address).call(undefined, currentBlock.number)

    const go = this.goldfinchProtocol.getContract<Go>("Go")
    const golisted = await go.readOnly.methods.go(address).call(undefined, currentBlock.number)

    // check if user has non-US or US non-accredited UID
    const uniqueIdentity = this.goldfinchProtocol.getContract<UniqueIdentity>("UniqueIdentity")
    const ID_TYPE_0 = await uniqueIdentity.readOnly.methods.ID_TYPE_0().call()
    const ID_TYPE_2 = await uniqueIdentity.readOnly.methods.ID_TYPE_2().call()
    const balances = await uniqueIdentity.readOnly.methods
      .balanceOfBatch([address, address], [ID_TYPE_0, ID_TYPE_2])
      .call(undefined, currentBlock.number)
    const hasUID = balances.some((balance) => !new BigNumber(balance).isZero())

    return {
      legacyGolisted,
      golisted,
      hasUID,
    }
  }

  poolBalanceAsOf(blockNumExclusive: number): BigNumber {
    assertWithLoadedInfo(this)
    return getBalanceAsOf<PoolEventType, typeof WITHDRAWAL_MADE_EVENT>(
      this.info.value.poolEvents,
      blockNumExclusive,
      WITHDRAWAL_MADE_EVENT,
      getPoolEventAmount
    )
  }
}

async function getAndTransformUSDCEvents(
  usdc: USDC,
  spender: string,
  owner: string,
  currentBlock: BlockInfo
): Promise<HistoricalTx<ApprovalEventType>[]> {
  let approvalEvents = await usdc.contract.readOnly.getPastEvents(APPROVAL_EVENT, {
    filter: {owner, spender},
    fromBlock: "earliest",
    toBlock: currentBlock.number,
  })
  approvalEvents = _.chain(approvalEvents)
    .compact()
    .map((e) => _.set(e, "erc20", usdc))
    .value()
  return await mapEventsToTx<ApprovalEventType>(approvalEvents, APPROVAL_EVENT_TYPES, {
    parseName: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT:
          return USDC_APPROVAL_TX_TYPE
        default:
          return assertUnreachable(eventData.event)
      }
    },
    parseAmount: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT: {
          return {
            amount: eventData.returnValues.value,
            units: "usdc",
          }
        }
        default:
          return assertUnreachable(eventData.event)
      }
    },
  })
}

async function getAndTransformFIDUEvents(
  goldfinchProtocol: GoldfinchProtocol,
  owner: string,
  currentBlock: BlockInfo
): Promise<HistoricalTx<ApprovalEventType>[]> {
  const approvalEvents = await goldfinchProtocol.queryEvents("Fidu", APPROVAL_EVENT_TYPES, {owner}, currentBlock.number)
  return await mapEventsToTx<ApprovalEventType>(approvalEvents, APPROVAL_EVENT_TYPES, {
    parseName: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT:
          return FIDU_APPROVAL_TX_TYPE
        default:
          return assertUnreachable(eventData.event)
      }
    },
    parseAmount: (eventData: KnownEventData<ApprovalEventType>) => {
      switch (eventData.event) {
        case APPROVAL_EVENT: {
          return {
            amount: eventData.returnValues.value,
            units: "fidu",
          }
        }
        default:
          return assertUnreachable(eventData.event)
      }
    },
  })
}

async function getPoolEvents(
  pool: SeniorPoolLoaded,
  address: string,
  currentBlock: BlockInfo
): Promise<KnownEventData<PoolEventType>[]> {
  return await pool.getPoolEvents(address, POOL_EVENT_TYPES, true, currentBlock.number)
}

async function getAndTransformCreditDeskEvents(
  creditDesk: Web3IO<CreditDesk>,
  address: string[],
  networkId: string,
  currentBlock: BlockInfo
): Promise<HistoricalTx<CreditDeskEventType>[]> {
  const fromBlock = getFromBlock(networkId)
  const [paymentEvents, drawdownEvents] = await Promise.all(
    CREDIT_DESK_EVENT_TYPES.map((eventName) => {
      return creditDesk.readOnly.getPastEvents(eventName, {
        filter: {payer: address, borrower: address},
        fromBlock,
        toBlock: currentBlock.number,
      })
    })
  )
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents))
  return await mapEventsToTx<CreditDeskEventType>(creditDeskEvents, CREDIT_DESK_EVENT_TYPES, {
    parseName: (eventData: KnownEventData<CreditDeskEventType>) => {
      switch (eventData.event) {
        case PAYMENT_COLLECTED_EVENT:
          return PAYMENT_TX_TYPE
        case DRAWDOWN_MADE_EVENT:
          return BORROW_TX_TYPE
        default:
          return assertUnreachable(eventData.event)
      }
    },
    parseAmount: (eventData: KnownEventData<CreditDeskEventType>) => {
      switch (eventData.event) {
        case PAYMENT_COLLECTED_EVENT:
          return {
            amount: eventData.returnValues.paymentAmount,
            units: "usdc",
          }
        case DRAWDOWN_MADE_EVENT:
          return {
            amount: eventData.returnValues.drawdownAmount,
            units: "usdc",
          }
        default:
          return assertUnreachable(eventData.event)
      }
    },
  })
}

async function getOverlappingStakingRewardsEvents(
  address: string,
  stakingRewards: StakingRewardsLoaded
): Promise<WithCurrentBlock<{value: KnownEventData<StakingRewardsEventType>[]}>> {
  return {
    currentBlock: stakingRewards.info.value.currentBlock,
    value: await stakingRewards.getEvents(
      address,
      STAKING_REWARDS_EVENT_TYPES,
      undefined,
      stakingRewards.info.value.currentBlock.number
    ),
  }
}

function getNonOverlappingStakingRewardsEvents(
  overlappingStakingRewardsEvents: KnownEventData<StakingRewardsEventType>[]
): KnownEventData<StakingRewardsEventType>[] {
  // We want to eliminate `STAKED_EVENT`s and `UNSTAKED_EVENTS` that are redundant with a corresponding
  // `DEPOSITED_AND_STAKED_EVENT`, or `UNSTAKED_AND_WITHDREW_EVENT` or `UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT`,
  // respectively. To do that, we make an ASSUMPTION: that only one such event and its corresponding
  // event can have been emitted in a given transaction. In practice, this assumption is not guaranteed
  // to be true, because there's nothing to stop someone from performing multiple stakings or unstakings
  // in one transaction using a multi-send contract. But the assumption is true for transactions created
  // using our frontend, which is all we need to worry about supporting here.
  const reduced = overlappingStakingRewardsEvents.reduce<OverlapAccumulator>(
    (acc, curr) => {
      switch (curr.event) {
        case STAKED_EVENT:
          break
        case DEPOSITED_AND_STAKED_EVENT:
          acc.depositedAndStaked[curr.blockNumber] = acc.depositedAndStaked[curr.blockNumber] || {}
          acc.depositedAndStaked[curr.blockNumber]![curr.transactionIndex] = true
          break
        case UNSTAKED_EVENT:
          break
        case UNSTAKED_AND_WITHDREW_EVENT:
          acc.unstakedAndWithdrew[curr.blockNumber] = acc.unstakedAndWithdrew[curr.blockNumber] || {}
          acc.unstakedAndWithdrew[curr.blockNumber]![curr.transactionIndex] = true
          break
        case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
          acc.unstakedAndWithdrewMultiple[curr.blockNumber] = acc.unstakedAndWithdrewMultiple[curr.blockNumber] || {}
          acc.unstakedAndWithdrewMultiple[curr.blockNumber]![curr.transactionIndex] = true
          break
        case REWARD_PAID_EVENT:
          break
        default:
          assertUnreachable(curr.event)
      }
      return acc
    },
    {
      depositedAndStaked: {},
      unstakedAndWithdrew: {},
      unstakedAndWithdrewMultiple: {},
    }
  )
  return overlappingStakingRewardsEvents.filter((eventData): boolean => {
    switch (eventData.event) {
      case STAKED_EVENT:
        return !reduced.depositedAndStaked[eventData.blockNumber]?.[eventData.transactionIndex]
      case DEPOSITED_AND_STAKED_EVENT:
        return true
      case UNSTAKED_EVENT:
        return (
          !reduced.unstakedAndWithdrew[eventData.blockNumber]?.[eventData.transactionIndex] &&
          !reduced.unstakedAndWithdrewMultiple[eventData.blockNumber]?.[eventData.transactionIndex]
        )
      case UNSTAKED_AND_WITHDREW_EVENT:
      case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
      case REWARD_PAID_EVENT:
        return true
      default:
        return assertUnreachable(eventData.event)
    }
  })
}

type CorrespondingExistsInfo = {
  [blockNumber: number]: {
    [txIndex: number]: true
  }
}

type OverlapAccumulator = {
  depositedAndStaked: CorrespondingExistsInfo
  unstakedAndWithdrew: CorrespondingExistsInfo
  unstakedAndWithdrewMultiple: CorrespondingExistsInfo
}

async function getAndTransformCommunityRewardsEvents(
  address: string,
  communityRewards: CommunityRewardsLoaded
): Promise<HistoricalTx<CommunityRewardsEventType>[]> {
  return communityRewards
    .getEvents(address, COMMUNITY_REWARDS_EVENT_TYPES, undefined, communityRewards.info.value.currentBlock.number)
    .then((events) =>
      mapEventsToTx(events, COMMUNITY_REWARDS_EVENT_TYPES, {
        parseName: (eventData: KnownEventData<CommunityRewardsEventType>) => {
          switch (eventData.event) {
            case REWARD_PAID_EVENT:
              return CLAIM_TX_TYPE
            default:
              return assertUnreachable(eventData.event)
          }
        },
        parseAmount: (eventData: KnownEventData<CommunityRewardsEventType>) => {
          switch (eventData.event) {
            case REWARD_PAID_EVENT:
              return {
                amount: eventData.returnValues.reward,
                units: "gfi",
              }
            default:
              return assertUnreachable(eventData.event)
          }
        },
      })
    )
}

async function getAndTransformMerkleDistributorEvents(
  address: string,
  merkleDistributor: MerkleDistributorLoaded
): Promise<HistoricalTx<MerkleDistributorEventType>[]> {
  return merkleDistributor
    .getEvents(address, MERKLE_DISTRIBUTOR_EVENT_TYPES, undefined, merkleDistributor.info.value.currentBlock.number)
    .then((events) =>
      mapEventsToTx(events, MERKLE_DISTRIBUTOR_EVENT_TYPES, {
        parseName: (eventData: KnownEventData<MerkleDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return ACCEPT_TX_TYPE
            default:
              return assertUnreachable(eventData.event)
          }
        },
        parseAmount: (eventData: KnownEventData<MerkleDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return {
                amount: eventData.returnValues.amount,
                units: "gfi",
              }
            default:
              return assertUnreachable(eventData.event)
          }
        },
      })
    )
}

async function getAndTransformMerkleDirectDistributorEvents(
  address: string,
  merkleDirectDistributor: MerkleDirectDistributorLoaded
): Promise<HistoricalTx<MerkleDirectDistributorEventType>[]> {
  return merkleDirectDistributor
    .getEvents(
      address,
      MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES,
      undefined,
      merkleDirectDistributor.info.value.currentBlock.number
    )
    .then((events) =>
      mapEventsToTx(events, MERKLE_DIRECT_DISTRIBUTOR_EVENT_TYPES, {
        parseName: (eventData: KnownEventData<MerkleDirectDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return ACCEPT_TX_TYPE
            default:
              return assertUnreachable(eventData.event)
          }
        },
        parseAmount: (eventData: KnownEventData<MerkleDirectDistributorEventType>) => {
          switch (eventData.event) {
            case GRANT_ACCEPTED_EVENT:
              return {
                amount: eventData.returnValues.amount,
                units: "gfi",
              }
            default:
              return assertUnreachable(eventData.event)
          }
        },
      })
    )
}

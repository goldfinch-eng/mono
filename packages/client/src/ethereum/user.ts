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
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/web3/UniqueIdentity"
import {asNonNullable, assertUnreachable} from "@goldfinch-eng/utils/src/type"
import BigNumber from "bignumber.js"
import _ from "lodash"
import {
  ApprovalEventType,
  APPROVAL_EVENT,
  APPROVAL_EVENT_TYPES,
  BackerMerkleDirectDistributorEventType,
  BackerMerkleDistributorEventType,
  CommunityRewardsEventType,
  COMMUNITY_REWARDS_EVENT_TYPES,
  CreditDeskEventType,
  CREDIT_DESK_EVENT_TYPES,
  DEPOSITED_AND_STAKED_EVENT,
  DEPOSITED_TO_CURVE_EVENT,
  DEPOSITED_TO_CURVE_AND_STAKED_EVENT,
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
  UNSTAKED_MULTIPLE_EVENT,
} from "../types/events"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../types/loadable"
import {
  AcceptedMerkleDirectDistributorGrant,
  NotAcceptedMerkleDirectDistributorGrant,
} from "../types/merkleDirectDistributor"
import {AcceptedMerkleDistributorGrant, NotAcceptedMerkleDistributorGrant} from "../types/merkleDistributor"
import {
  ACCEPT_TX_TYPE,
  AmountUnits,
  BORROW_TX_TYPE,
  CLAIM_TX_TYPE,
  DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE,
  DEPOSIT_TO_CURVE_TX_TYPE,
  FIDU_APPROVAL_TX_TYPE,
  HistoricalTx,
  PAYMENT_TX_TYPE,
  STAKE_TX_TYPE,
  SUPPLY_AND_STAKE_TX_TYPE,
  SUPPLY_TX_TYPE,
  UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
  UNSTAKE_MULTIPLE_TX_TYPE,
  UNSTAKE_TX_NAME,
  USDC_APPROVAL_TX_TYPE,
  WITHDRAW_FROM_SENIOR_POOL_TX_TYPE,
} from "../types/transactions"
import {Web3IO} from "../types/web3"
import {assertNonNullable, assertNumber, BlockInfo, defaultSum, WithCurrentBlock} from "../utils"
import getWeb3 from "../web3"
import {BackerMerkleDirectDistributorLoaded} from "./backerMerkleDirectDistributor"
import {BackerMerkleDistributorLoaded} from "./backerMerkleDistributor"
import {BackerRewardsLoaded, BackerRewardsPoolTokenPosition, BackerRewardsPosition} from "./backerRewards"
import {BorrowerInterface, getBorrowerContract} from "./borrower"
import {CommunityRewardsGrant, CommunityRewardsGrantAcceptanceContext, CommunityRewardsLoaded} from "./communityRewards"
import {ERC20, Ticker, USDC, usdcFromAtomic} from "./erc20"
import {getBalanceAsOf, getPoolEventAmount, mapEventsToTx, populateDates} from "./events"
import {GFILoaded} from "./gfi"
import {getCachedPastEvents, GoldfinchProtocol} from "./GoldfinchProtocol"
import {MerkleDirectDistributorLoaded} from "./merkleDirectDistributor"
import {MerkleDistributorLoaded} from "./merkleDistributor"
import {TranchedPoolBacker} from "./tranchedPool"
import {
  getStakedPositionTypeByValue,
  SeniorPoolLoaded,
  StakedPositionType,
  StakingRewardsLoaded,
  StakingRewardsPosition,
} from "./pool"
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
  backerMerkleDistributor: BackerMerkleDistributorLoaded,
  backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded,
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
    backerMerkleDistributor,
    backerMerkleDirectDistributor,
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
              stakingRewards.getStoredPosition(tokenId, currentBlock).then(async (storedPosition) => {
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
            tokenIds.map(async (tokenId): Promise<CommunityRewardsGrantAcceptanceContext | undefined> => {
              const {events, source, userDistributor} = await this.getAcceptedEventsForMerkleDistributorScenarios(
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
                    grantInfo: airdrop.grantInfo,
                    event: acceptanceEvent,
                    source,
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
      .then(([tokenIds, rawGrants, claimables, acceptanceContexts]) =>
        tokenIds.map((tokenId, i): CommunityRewardsGrant => {
          const rawGrant = rawGrants[i]
          assertNonNullable(rawGrant)
          const claimable = claimables[i]
          assertNonNullable(claimable)
          const acceptanceContext = acceptanceContexts[i]
          return UserCommunityRewards.parseCommunityRewardsGrant(
            tokenId,
            new BigNumber(claimable),
            rawGrant,
            acceptanceContext
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

  async getAcceptedEventsForMerkleDistributorScenarios(
    merkleDistributor: MerkleDistributorLoaded,
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    tokenId: string,
    currentBlock: BlockInfo,
    userMerkleDistributor: UserMerkleDistributorLoaded,
    userBackerMerkleDistributor: UserBackerMerkleDistributorLoaded
  ): Promise<
    | {
        events: KnownEventData<typeof GRANT_ACCEPTED_EVENT>[]
        source: "merkleDistributor"
        userDistributor: UserMerkleDistributorLoaded
      }
    | {
        events: KnownEventData<typeof GRANT_ACCEPTED_EVENT>[]
        source: "backerMerkleDistributor"
        userDistributor: UserBackerMerkleDistributorLoaded
      }
  > {
    const merkleDistributorEvents = await this.goldfinchProtocol.queryEvents(
      merkleDistributor.contract.readOnly,
      [GRANT_ACCEPTED_EVENT],
      {tokenId, account: this.address},
      currentBlock.number
    )
    if (merkleDistributorEvents.length === 0) {
      const backerMerkleDistributorEvents = await this.goldfinchProtocol.queryEvents(
        backerMerkleDistributor.contract.readOnly,
        [GRANT_ACCEPTED_EVENT],
        {tokenId, account: this.address},
        currentBlock.number
      )
      return {
        events: backerMerkleDistributorEvents,
        source: "backerMerkleDistributor",
        userDistributor: userBackerMerkleDistributor,
      }
    } else {
      return {events: merkleDistributorEvents, source: "merkleDistributor", userDistributor: userMerkleDistributor}
    }
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
    acceptanceContext: CommunityRewardsGrantAcceptanceContext | undefined
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
      acceptanceContext
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
    return getMerkleDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return UserMerkleDistributor.getAirdropsWithAcceptance(airdropsForRecipient, merkleDistributor, currentBlock)
  }

  async initialize(
    merkleDistributor: MerkleDistributorLoaded,
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
    return getBackerMerkleDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDistributorGrantInfo[],
    merkleDistributor: MerkleDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return UserBackerMerkleDistributor.getAirdropsWithAcceptance(airdropsForRecipient, merkleDistributor, currentBlock)
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
    return getMerkleDirectDistributorInfo(this.goldfinchProtocol.networkId)
  }

  async _getAirdropsWithAcceptance(
    airdropsForRecipient: MerkleDirectDistributorGrantInfo[],
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    return UserMerkleDirectDistributor.getAirdropsWithAcceptance(
      airdropsForRecipient,
      merkleDirectDistributor,
      currentBlock
    )
  }

  async initialize(merkleDirectDistributor: MerkleDirectDistributorLoaded, currentBlock: BlockInfo): Promise<void> {
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
    return getBackerMerkleDirectDistributorInfo(this.goldfinchProtocol.networkId)
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

export const NON_US_INDIVIDUAL_ID_TYPE_0 = "0"
export const US_ACCREDITED_INDIVIDUAL_ID_TYPE_1 = "1"
export const US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2 = "2"
export const US_ENTITY_ID_TYPE_3 = "3"
export const NON_US_ENTITY_ID_TYPE_4 = "4"

export type UIDType =
  | typeof NON_US_INDIVIDUAL_ID_TYPE_0
  | typeof US_ACCREDITED_INDIVIDUAL_ID_TYPE_1
  | typeof US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2
  | typeof US_ENTITY_ID_TYPE_3
  | typeof NON_US_ENTITY_ID_TYPE_4
export type UIDTypeToBalance = Record<UIDType, boolean>

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
  uidTypeToBalance: UIDTypeToBalance
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
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded,
    currentBlock: BlockInfo
  ) {
    const usdc = this.goldfinchProtocol.getERC20(Ticker.USDC)

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
      backerMerkleDistributorTxs,
      backerMerkleDirectDistributorTxs,
    ] = await this._fetchTxs(
      usdc,
      pool,
      stakingRewards,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      backerMerkleDistributor,
      backerMerkleDirectDistributor,
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
          ...backerMerkleDistributorTxs,
          ...backerMerkleDirectDistributorTxs,
        ],
        ["blockNumber", "transactionIndex"]
      )
    )
    pastTxs = await populateDates(pastTxs)

    const {goListed, uidTypeToBalance} = await this._fetchGoListStatus(this.address, currentBlock)

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
        uidTypeToBalance,
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
    backerMerkleDistributor: BackerMerkleDistributorLoaded,
    backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded,
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
          poolTxs: mapEventsToTx(poolEvents, POOL_EVENT_TYPES, {
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

      getOverlappingStakingRewardsEvents(this.address, stakingRewards).then((overlappingStakingRewardsEvents) => {
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
          stakingRewardsTxs: mapEventsToTx(nonOverlappingEvents, STAKING_REWARDS_EVENT_TYPES, {
            parseName: (eventData: KnownEventData<StakingRewardsEventType>) => {
              switch (eventData.event) {
                case STAKED_EVENT:
                  return STAKE_TX_TYPE
                case DEPOSITED_AND_STAKED_EVENT:
                  return SUPPLY_AND_STAKE_TX_TYPE
                case DEPOSITED_TO_CURVE_EVENT:
                  return DEPOSIT_TO_CURVE_TX_TYPE
                case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
                  return DEPOSIT_TO_CURVE_AND_STAKE_TX_TYPE
                case UNSTAKED_EVENT:
                  return UNSTAKE_TX_NAME
                case UNSTAKED_AND_WITHDREW_EVENT:
                case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
                  return UNSTAKE_AND_WITHDRAW_FROM_SENIOR_POOL_TX_TYPE
                case UNSTAKED_MULTIPLE_EVENT:
                  return UNSTAKE_MULTIPLE_TX_TYPE
                case REWARD_PAID_EVENT:
                  return CLAIM_TX_TYPE
                default:
                  return assertUnreachable(eventData.event)
              }
            },
            parseAmount: async (eventData: KnownEventData<StakingRewardsEventType>) => {
              switch (eventData.event) {
                case STAKED_EVENT:
                  return {
                    amount: eventData.returnValues.amount,
                    units: this.getUnitsForStakedPositionType(eventData.returnValues.positionType),
                  }
                case DEPOSITED_AND_STAKED_EVENT:
                  return {
                    amount: eventData.returnValues.depositedAmount,
                    units: "usdc",
                  }
                case DEPOSITED_TO_CURVE_EVENT:
                case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
                  const fiduAmount = eventData.returnValues.fiduAmount
                  const usdcAmount = eventData.returnValues.usdcAmount
                  if (new BigNumber(fiduAmount).isZero() && !new BigNumber(usdcAmount).isZero()) {
                    // USDC-only deposit
                    return {
                      amount: usdcAmount,
                      units: "usdc",
                    }
                  } else if (!new BigNumber(fiduAmount).isZero() && new BigNumber(usdcAmount).isZero()) {
                    // FIDU-only deposit
                    return {
                      amount: fiduAmount,
                      units: "fidu",
                    }
                  } else {
                    throw new Error("Cannot deposit both FIDU and USDC")
                  }
                case UNSTAKED_EVENT:
                  return {
                    amount: eventData.returnValues.amount,
                    units: this.getUnitsForStakedPositionType(eventData.returnValues.positionType),
                  }
                case UNSTAKED_AND_WITHDREW_EVENT:
                case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
                  return {
                    amount: eventData.returnValues.usdcReceivedAmount,
                    units: "usdc",
                  }
                case UNSTAKED_MULTIPLE_EVENT:
                  // We can assume that all positions in an "Unstaked Multiple" event are of the same
                  // position type, so we just check the type of the first unstaked position.
                  const tokenId = eventData.returnValues.tokenIds[0]
                  const position = await stakingRewards.contract.readOnly.methods
                    .positions(tokenId)
                    .call(undefined, "latest")
                  return {
                    amount: eventData.returnValues.amounts.reduce(
                      (sum, amount) => new BigNumber(amount).plus(sum),
                      new BigNumber(0)
                    ),
                    units: this.getUnitsForStakedPositionType(parseInt(position.positionType)),
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
      getAndTransformBackerMerkleDistributorEvents(this.address, backerMerkleDistributor),
      getAndTransformBackerMerkleDirectDistributorEvents(this.address, backerMerkleDirectDistributor),
    ])
  }

  isUnlocked(allowance: BigNumber | undefined) {
    return !allowance || allowance.gte(UNLOCK_THRESHOLD)
  }

  getUnitsForStakedPositionType(stakedPositionTypeValue: number): AmountUnits {
    const positionType = getStakedPositionTypeByValue(stakedPositionTypeValue)
    switch (positionType) {
      case StakedPositionType.Fidu:
        return "fidu"
      case StakedPositionType.CurveLP:
        return "fidu-usdc-f"
      default:
        return assertUnreachable(positionType)
    }
  }

  async _fetchGoListStatus(
    address: string,
    currentBlock: BlockInfo
  ): Promise<{
    goListed: boolean
    uidTypeToBalance: UIDTypeToBalance
  }> {
    const go = this.goldfinchProtocol.getContract<Go>("Go")
    const goListed = await go.readOnly.methods.go(address).call(undefined, currentBlock.number)

    // check if user has non-US or US non-accredited UID
    const uniqueIdentity = this.goldfinchProtocol.getContract<UniqueIdentity>("UniqueIdentity")
    const balances = await uniqueIdentity.readOnly.methods
      .balanceOfBatch(
        [address, address, address, address, address],
        [
          NON_US_INDIVIDUAL_ID_TYPE_0,
          US_ACCREDITED_INDIVIDUAL_ID_TYPE_1,
          US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2,
          US_ENTITY_ID_TYPE_3,
          NON_US_ENTITY_ID_TYPE_4,
        ]
      )
      .call(undefined, currentBlock.number)

    const hasNonUSUID = !new BigNumber(String(balances[0])).isZero()
    const hasUSAccreditedUID = !new BigNumber(String(balances[1])).isZero()
    const hasUSNonAccreditedUID = !new BigNumber(String(balances[2])).isZero()
    const hasUSEntityUID = !new BigNumber(String(balances[3])).isZero()
    const hasNonUSEntityUID = !new BigNumber(String(balances[4])).isZero()

    return {
      goListed,
      uidTypeToBalance: {
        [NON_US_INDIVIDUAL_ID_TYPE_0]: hasNonUSUID,
        [US_ACCREDITED_INDIVIDUAL_ID_TYPE_1]: hasUSAccreditedUID,
        [US_NON_ACCREDITED_INDIVIDUAL_ID_TYPE_2]: hasUSNonAccreditedUID,
        [US_ENTITY_ID_TYPE_3]: hasUSEntityUID,
        [NON_US_ENTITY_ID_TYPE_4]: hasNonUSEntityUID,
      },
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
  let approvalEvents = await getCachedPastEvents(usdc.contract.readOnly, APPROVAL_EVENT, {
    filter: {owner, spender},
    fromBlock: "earliest",
    toBlock: currentBlock.number,
  })
  approvalEvents = _.chain(approvalEvents)
    .compact()
    .map((e) => _.set(e, "erc20", usdc))
    .value()
  return mapEventsToTx<ApprovalEventType>(approvalEvents, APPROVAL_EVENT_TYPES, {
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
  return mapEventsToTx<ApprovalEventType>(approvalEvents, APPROVAL_EVENT_TYPES, {
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
    CREDIT_DESK_EVENT_TYPES.map((eventName) =>
      getCachedPastEvents(creditDesk.readOnly, eventName, {
        filter: {payer: address, borrower: address},
        fromBlock,
        toBlock: currentBlock.number,
      })
    )
  )
  const creditDeskEvents = _.compact(_.concat(paymentEvents, drawdownEvents))
  return mapEventsToTx<CreditDeskEventType>(creditDeskEvents, CREDIT_DESK_EVENT_TYPES, {
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
        case DEPOSITED_TO_CURVE_EVENT:
          break
        case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
          acc.depositedToCurveAndStaked[curr.blockNumber] = acc.depositedToCurveAndStaked[curr.blockNumber] || {}
          acc.depositedToCurveAndStaked[curr.blockNumber]![curr.transactionIndex] = true
          break
        case UNSTAKED_EVENT:
          break
        case UNSTAKED_AND_WITHDREW_EVENT:
          acc.unstakedAndWithdrew[curr.blockNumber] = acc.unstakedAndWithdrew[curr.blockNumber] || {}
          acc.unstakedAndWithdrew[curr.blockNumber]![curr.transactionIndex] = true
          break
        case UNSTAKED_MULTIPLE_EVENT:
          acc.unstakedMultiple[curr.blockNumber] = acc.unstakedMultiple[curr.blockNumber] || {}
          acc.unstakedMultiple[curr.blockNumber]![curr.transactionIndex] = true
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
      depositedToCurveAndStaked: {},
      unstakedAndWithdrew: {},
      unstakedMultiple: {},
      unstakedAndWithdrewMultiple: {},
    }
  )
  return overlappingStakingRewardsEvents.filter((eventData): boolean => {
    switch (eventData.event) {
      case STAKED_EVENT:
        return (
          !reduced.depositedAndStaked[eventData.blockNumber]?.[eventData.transactionIndex] &&
          !reduced.depositedToCurveAndStaked[eventData.blockNumber]?.[eventData.transactionIndex]
        )
      case DEPOSITED_AND_STAKED_EVENT:
      case DEPOSITED_TO_CURVE_EVENT:
      case DEPOSITED_TO_CURVE_AND_STAKED_EVENT:
        return true
      case UNSTAKED_EVENT:
        return (
          !reduced.unstakedAndWithdrew[eventData.blockNumber]?.[eventData.transactionIndex] &&
          !reduced.unstakedAndWithdrewMultiple[eventData.blockNumber]?.[eventData.transactionIndex] &&
          !reduced.unstakedMultiple[eventData.blockNumber]?.[eventData.transactionIndex]
        )
      case UNSTAKED_AND_WITHDREW_EVENT:
      case UNSTAKED_AND_WITHDREW_MULTIPLE_EVENT:
      case UNSTAKED_MULTIPLE_EVENT:
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
  depositedToCurveAndStaked: CorrespondingExistsInfo
  unstakedAndWithdrew: CorrespondingExistsInfo
  unstakedMultiple: CorrespondingExistsInfo
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

async function getAndTransformBackerMerkleDistributorEvents(
  address: string,
  backerMerkleDistributor: BackerMerkleDistributorLoaded
): Promise<HistoricalTx<BackerMerkleDistributorEventType>[]> {
  return getAndTransformMerkleDistributorEvents(address, backerMerkleDistributor)
}

async function getAndTransformBackerMerkleDirectDistributorEvents(
  address: string,
  backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded
): Promise<HistoricalTx<BackerMerkleDirectDistributorEventType>[]> {
  return getAndTransformMerkleDirectDistributorEvents(address, backerMerkleDirectDistributor)
}

type UserBackerRewardsLoadedInfo = {
  currentBlock: BlockInfo
  positions: BackerRewardsPosition[]
  claimable: BigNumber
  unvested: BigNumber
}

export class UserBackerRewards {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  info: Loadable<UserBackerRewardsLoadedInfo>

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
    backerRewards: BackerRewardsLoaded,
    rewardsEligibleTranchedPoolBackers: TranchedPoolBacker[],
    currentBlock: BlockInfo
  ): Promise<void> {
    const web3 = getWeb3()
    const positions = await Promise.all(
      rewardsEligibleTranchedPoolBackers
        .filter(
          // Remove rewards-eligible tranched pools for which the user has no junior-tranche pool tokens (and for
          // which they therefore cannot earn any backer rewards).
          (backer) =>
            !!backer.tokenInfos.filter((tokenInfo) => !backer.tranchedPool.isSeniorTrancheId(tokenInfo.tranche)).length
        )
        .map(async (backer): Promise<BackerRewardsPosition> => {
          // We expect `firstDepositBlockNumber` to be non-nullable, because we have filtered out tranched pools
          // in which the user holds no pool tokens. So we expect to have found the block number of the first
          // DepositMade event corresponding to the set of pool tokens they have for this pool.
          const firstDepositBlockNumber = asNonNullable(backer.firstDepositBlockNumber)

          const [tokenPositions, firstDepositBlock] = await Promise.all([
            Promise.all(
              backer.tokenInfos.map(async (tokenInfo): Promise<BackerRewardsPoolTokenPosition> => {
                const tokenId = tokenInfo.id
                const [
                  backersOnlyClaimable,
                  seniorPoolMatchingClaimable,
                  backersOnlyTokenInfo,
                  seniorPoolMatchingClaimed,
                ] = await Promise.all([
                  backerRewards.contract.readOnly.methods
                    .poolTokenClaimableRewards(tokenId)
                    .call(undefined, currentBlock.number),
                  backerRewards.contract.readOnly.methods
                    .stakingRewardsEarnedSinceLastWithdraw(tokenId)
                    .call(undefined, currentBlock.number),
                  backerRewards.contract.readOnly.methods.tokens(tokenId).call(undefined, currentBlock.number),
                  backerRewards.contract.readOnly.methods
                    .stakingRewardsClaimed(tokenId)
                    .call(undefined, currentBlock.number),
                ])
                return {
                  tokenId,
                  claimed: {
                    backersOnly: new BigNumber(backersOnlyTokenInfo.rewardsClaimed),
                    seniorPoolMatching: new BigNumber(seniorPoolMatchingClaimed),
                  },
                  claimable: {
                    backersOnly: new BigNumber(backersOnlyClaimable),
                    seniorPoolMatching: new BigNumber(seniorPoolMatchingClaimable),
                  },
                  unvested: {
                    backersOnly: new BigNumber(0),
                    seniorPoolMatching: new BigNumber(0),
                  },
                }
              })
            ),
            web3.readOnly.eth.getBlock(firstDepositBlockNumber),
          ])
          const firstDepositTime = firstDepositBlock.timestamp
          assertNumber(firstDepositTime)

          const rewardsNotWithdrawableReason = backerRewards.juniorTranchePoolTokenRewardsAreNotWithdrawableReason(
            backer.tranchedPool
          )

          return new BackerRewardsPosition(backer, firstDepositTime, rewardsNotWithdrawableReason, tokenPositions)
        })
    )

    const claimable = defaultSum(positions.map((position) => position.claimable))
    const unvested = defaultSum(positions.map((position) => position.unvested))

    this.info = {
      loaded: true,
      value: {
        currentBlock,
        positions,
        claimable,
        unvested,
      },
    }
  }
}

export type UserBackerRewardsLoaded = WithLoadedInfo<UserBackerRewards, UserBackerRewardsLoadedInfo>

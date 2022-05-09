import {asNonNullable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {KnownEventData, STAKED_EVENT} from "../../types/events"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../../types/loadable"
import {BlockInfo, defaultSum} from "../../utils"
import {PositionOptimisticIncrement, StakingRewardsLoaded, StakingRewardsPosition, StoredPosition} from "../pool"

type UserStakingRewardsLoadedInfo = {
  currentBlock: BlockInfo
  positions: StakingRewardsPosition[]
  claimable: BigNumber
  unvested: BigNumber
  granted: BigNumber
}

export type UserStakingRewardsLoaded = WithLoadedInfo<UserStakingRewards, UserStakingRewardsLoadedInfo>

export class UserStakingRewards {
  info: Loadable<UserStakingRewardsLoadedInfo>

  constructor() {
    this.info = {
      loaded: false,
      value: undefined,
    }
  }

  async initialize(address: string, stakingRewards: StakingRewardsLoaded, currentBlock: BlockInfo): Promise<void> {
    const positions = await this.getTokenIds({address, stakingRewards, currentBlock})
      .then((tokenIds: string[]) =>
        Promise.all([
          tokenIds,
          this.getStoredPositionsWithOptimisticIncrements({tokenIds, stakingRewards, currentBlock}),
          this.getStakedEvents({tokenIds, stakingRewards, currentBlock}),
          this.getCurrentEarnRateForPositions({tokenIds, stakingRewards, currentBlock}),
        ])
      )
      .then(([tokenIds, storedAndIncrements, correspondingStakedEvents, currentEarnRates]) => {
        return tokenIds.map((tokenId, i) =>
          this.buildStakingRewardsPosition({
            tokenId,
            stakedEvent: asNonNullable(correspondingStakedEvents[i]),
            storedPosition: asNonNullable(storedAndIncrements[i]?.storedPosition),
            optimisticIncrement: asNonNullable(storedAndIncrements[i]?.optimisticIncrement),
            currentEarnRate: asNonNullable(currentEarnRates[i]),
          })
        )
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

  buildStakingRewardsPosition({
    tokenId,
    currentEarnRate,
    stakedEvent,
    storedPosition,
    optimisticIncrement,
  }: {
    tokenId: string
    currentEarnRate: string
    stakedEvent: KnownEventData<typeof STAKED_EVENT>
    storedPosition: StoredPosition
    optimisticIncrement: PositionOptimisticIncrement
  }): StakingRewardsPosition {
    return new StakingRewardsPosition(
      tokenId,
      stakedEvent,
      new BigNumber(currentEarnRate),
      storedPosition,
      optimisticIncrement
    )
  }

  async getTokenIds({address, stakingRewards, currentBlock}): Promise<string[]> {
    return stakingRewards.contract.readOnly.methods
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
  }

  async getStakedEvents({
    tokenIds,
    stakingRewards,
    currentBlock,
  }: {
    tokenIds: string[]
    stakingRewards: StakingRewardsLoaded
    currentBlock: BlockInfo
  }): Promise<KnownEventData<typeof STAKED_EVENT>[]> {
    if (tokenIds.length === 0) {
      return Promise.resolve([])
    }

    return (
      stakingRewards
        // Fetch all Staked events for the positions that the user currently holds.
        // This handles scenarios where token transfers have occurred where the
        // user was the recipient.
        .getEventsForPositions<typeof STAKED_EVENT>(tokenIds, ["Staked"], undefined, currentBlock.number)
        .then((stakedEventsForPositions) =>
          Promise.all(
            tokenIds.map(async (tokenId) => {
              const stakedEvent = stakedEventsForPositions.find(
                (stakedEvent: KnownEventData<typeof STAKED_EVENT>) => stakedEvent.returnValues.tokenId === tokenId
              )
              if (!stakedEvent) {
                throw new Error(
                  `Failed to retrieve Staked event for tokenId ${tokenId}, from set for token ids: ${stakedEventsForPositions.map(
                    (stakedEvent: KnownEventData<typeof STAKED_EVENT>) => stakedEvent.returnValues.tokenId
                  )}`
                )
              }
              return stakedEvent
            })
          )
        )
    )
  }

  async getStoredPositionsWithOptimisticIncrements({
    tokenIds,
    stakingRewards,
    currentBlock,
  }): Promise<{storedPosition: StoredPosition; optimisticIncrement: PositionOptimisticIncrement}[]> {
    return Promise.all(
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
    )
  }

  async getCurrentEarnRateForPositions({tokenIds, stakingRewards, currentBlock}): Promise<string[]> {
    return Promise.all(
      tokenIds.map((tokenId) =>
        stakingRewards.contract.readOnly.methods.positionCurrentEarnRate(tokenId).call(undefined, currentBlock.number)
      )
    )
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

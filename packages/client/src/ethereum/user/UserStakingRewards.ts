import BigNumber from "bignumber.js"
import {KnownEventData, STAKED_EVENT} from "../../types/events"
import {assertWithLoadedInfo, Loadable, WithLoadedInfo} from "../../types/loadable"
import {assertNonNullable, BlockInfo, defaultSum, WithCurrentBlock} from "../../utils"
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
    const positions = await this.getTokenIds({address, stakingRewards, currentBlock})
      .then((tokenIds: string[]) =>
        Promise.all([
          tokenIds,
          this.getStoredPositionsWithOptimisticIncrements({tokenIds, stakingRewards, currentBlock}),
          this.getStakedEvents({tokenIds, stakedEvents}),
          this.getCurrentEarnRateForPositions({tokenIds, stakingRewards, currentBlock}),
        ])
      )
      .then(([tokenIds, storedAndIncrements, correspondingStakedEvents, currentEarnRates]) => {
        return tokenIds.map((tokenId, i) =>
          this.buildStakingRewardsPosition({
            tokenId,
            stakedEvent: correspondingStakedEvents[i],
            storedPosition: storedAndIncrements[i]?.storedPosition,
            optimisticIncrement: storedAndIncrements[i]?.optimisticIncrement,
            currentEarnRate: currentEarnRates[i],
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
    currentEarnRate?: string
    stakedEvent?: KnownEventData<typeof STAKED_EVENT>
    storedPosition?: StoredPosition
    optimisticIncrement?: PositionOptimisticIncrement
  }): StakingRewardsPosition {
    assertNonNullable(storedPosition)
    assertNonNullable(optimisticIncrement)
    assertNonNullable(stakedEvent)
    assertNonNullable(currentEarnRate)

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

  async getStakedEvents({tokenIds, stakedEvents}): Promise<KnownEventData<typeof STAKED_EVENT>[]> {
    return Promise.all(
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

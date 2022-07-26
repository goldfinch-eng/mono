import {SeniorPoolStakedPosition} from "../../generated/schema"
import {
  RewardAdded,
  Staked,
  StakingRewards,
  Unstaked,
  Unstaked1,
  Transfer,
  DepositedAndStaked,
  UnstakedAndWithdrew,
} from "../../generated/templates/StakingRewards/StakingRewards"

import {createTransactionFromEvent} from "../entities/helpers"
import {updateCurrentEarnRate} from "../entities/staking_rewards"

export function handleRewardAdded(event: RewardAdded): void {
  updateCurrentEarnRate(event.address)
}

export function handleStaked(event: Staked): void {
  updateCurrentEarnRate(event.address)

  const stakedPosition = new SeniorPoolStakedPosition(event.params.tokenId.toString())
  stakedPosition.amount = event.params.amount
  stakedPosition.user = event.params.user.toHexString()

  const contract = StakingRewards.bind(event.address)
  const positionsResult = contract.try_positions(event.params.tokenId)
  if (!positionsResult.reverted) {
    stakedPosition.startTime = positionsResult.value.value1.startTime
    stakedPosition.endTime = positionsResult.value.value1.endTime
  }

  stakedPosition.save()
}

// Note that Unstaked and Unstaked1 refer to two different versions of this event with different signatures.
export function handleUnstaked(event: Unstaked): void {
  updateCurrentEarnRate(event.address)

  const stakedPosition = assert(SeniorPoolStakedPosition.load(event.params.tokenId.toString()))
  stakedPosition.amount = stakedPosition.amount.minus(event.params.amount)

  stakedPosition.save()
}

export function handleUnstaked1(event: Unstaked1): void {
  updateCurrentEarnRate(event.address)

  const stakedPosition = assert(SeniorPoolStakedPosition.load(event.params.tokenId.toString()))
  stakedPosition.amount = stakedPosition.amount.minus(event.params.amount)

  stakedPosition.save()
}

export function handleTransfer(event: Transfer): void {
  const stakedPosition = new SeniorPoolStakedPosition(event.params.tokenId.toString())
  stakedPosition.user = event.params.to.toHexString()

  const contract = StakingRewards.bind(event.address)
  stakedPosition.amount = contract.stakedBalanceOf(event.params.tokenId)
  const positionsResult = contract.try_positions(event.params.tokenId)
  if (!positionsResult.reverted) {
    stakedPosition.startTime = positionsResult.value.value1.startTime
    stakedPosition.endTime = positionsResult.value.value1.endTime
  }

  stakedPosition.save()
}

export function handleDepositedAndStaked(event: DepositedAndStaked): void {
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT_AND_STAKE")
  transaction.amount = event.params.depositedAmount
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

export function handleUnstakedAndWithdrew(event: UnstakedAndWithdrew): void {
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_UNSTAKE_AND_WITHDRAWAL")
  transaction.amount = event.params.usdcReceivedAmount
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

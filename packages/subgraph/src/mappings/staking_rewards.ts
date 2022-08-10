import {SeniorPoolStakedPosition} from "../../generated/schema"
import {
  RewardAdded,
  Staked,
  StakingRewards,
  Unstaked,
  Unstaked1,
  Transfer,
  DepositedAndStaked,
  DepositedAndStaked1,
  UnstakedAndWithdrew,
  UnstakedAndWithdrewMultiple,
} from "../../generated/templates/StakingRewards/StakingRewards"

import {createTransactionFromEvent} from "../entities/helpers"
import {updateCurrentEarnRate} from "../entities/staking_rewards"

function mapStakedPositionTypeToAmountToken(stakedPositionType: i32): string {
  // NOTE: The return type of this function should be an AmountToken enum value.

  if (stakedPositionType === 0) {
    return "FIDU"
  } else if (stakedPositionType === 1) {
    return "CURVE_LP"
  } else {
    throw new Error(`Unexpected staked position type: ${stakedPositionType}`)
  }
}

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

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_STAKE")
  transaction.amount = event.params.amount
  transaction.amountToken = mapStakedPositionTypeToAmountToken(event.params.positionType)
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

// Note that Unstaked and Unstaked1 refer to two different versions of this event with different signatures.
export function handleUnstaked(event: Unstaked): void {
  updateCurrentEarnRate(event.address)

  const stakedPosition = assert(SeniorPoolStakedPosition.load(event.params.tokenId.toString()))
  stakedPosition.amount = stakedPosition.amount.minus(event.params.amount)

  stakedPosition.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_UNSTAKE")
  transaction.amount = event.params.amount
  transaction.amountToken = mapStakedPositionTypeToAmountToken(
    // The historical/legacy Unstaked events that didn't have a `positionType` param were all of FIDU type.
    0
  )
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

export function handleUnstaked1(event: Unstaked1): void {
  updateCurrentEarnRate(event.address)

  const stakedPosition = assert(SeniorPoolStakedPosition.load(event.params.tokenId.toString()))
  stakedPosition.amount = stakedPosition.amount.minus(event.params.amount)

  stakedPosition.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_UNSTAKE")
  transaction.amount = event.params.amount
  transaction.amountToken = mapStakedPositionTypeToAmountToken(event.params.positionType)
  transaction.user = event.params.user.toHexString()
  transaction.save()
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
  transaction.amountToken = "USDC"
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

export function handleDepositedAndStaked1(event: DepositedAndStaked1): void {
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT_AND_STAKE")
  transaction.amount = event.params.depositedAmount
  transaction.amountToken = "USDC"
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

export function handleUnstakedAndWithdrew(event: UnstakedAndWithdrew): void {
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_UNSTAKE_AND_WITHDRAWAL")
  transaction.amount = event.params.usdcReceivedAmount
  transaction.amountToken = "USDC"
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

export function handleUnstakedAndWithdrewMultiple(event: UnstakedAndWithdrewMultiple): void {
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_UNSTAKE_AND_WITHDRAWAL")
  transaction.amount = event.params.usdcReceivedAmount
  transaction.amountToken = "USDC"
  transaction.user = event.params.user.toHexString()
  transaction.save()
}

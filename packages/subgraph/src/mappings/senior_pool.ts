import {Address, BigInt, store} from "@graphprotocol/graph-ts"
import {
  SeniorPool,
  DepositMade,
  InterestCollected,
  InvestmentMadeInJunior,
  InvestmentMadeInSenior,
  PrincipalCollected,
  PrincipalWrittenDown,
  ReserveFundsCollected,
  WithdrawalMade,
  WithdrawalRequested,
  WithdrawalAddedTo,
  WithdrawalCanceled,
  EpochEnded,
} from "../../generated/SeniorPool/SeniorPool"
import {WithdrawalTransaction, Epoch} from "../../generated/schema"

import {CONFIG_KEYS_ADDRESSES, FIDU_DECIMALS, USDC_DECIMALS} from "../constants"
import {createTransactionFromEvent, usdcWithFiduPrecision} from "../entities/helpers"
import {updatePoolInvestments, updatePoolStatus} from "../entities/senior_pool"
import {handleDeposit, getOrInitUser} from "../entities/user"
import {getAddressFromConfig} from "../utils"

// Helper function to extract the StakingRewards address from the config on Senior Pool
function getStakingRewardsAddressFromSeniorPoolAddress(seniorPoolAddress: Address): Address {
  const seniorPoolContract = SeniorPool.bind(seniorPoolAddress)
  return getAddressFromConfig(seniorPoolContract, CONFIG_KEYS_ADDRESSES.StakingRewards)
}

export function handleDepositMade(event: DepositMade): void {
  updatePoolStatus(event.address)
  handleDeposit(event)

  const stakingRewardsAddress = getStakingRewardsAddressFromSeniorPoolAddress(event.address)

  // Purposefully ignore deposits from StakingRewards contract because those will get captured as DepositAndStake events instead
  if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DEPOSIT", event.params.capitalProvider)

    transaction.sentAmount = event.params.amount
    transaction.sentToken = "USDC"
    transaction.receivedAmount = event.params.shares
    transaction.receivedToken = "FIDU"

    // usdc / fidu
    transaction.fiduPrice = usdcWithFiduPrecision(event.params.amount).div(event.params.shares)

    transaction.save()
  }
}

export function handleInterestCollected(event: InterestCollected): void {
  updatePoolStatus(event.address)
}

export function handleInvestmentMadeInJunior(event: InvestmentMadeInJunior): void {
  updatePoolStatus(event.address)
  updatePoolInvestments(event.address, event.params.tranchedPool)
}

export function handleInvestmentMadeInSenior(event: InvestmentMadeInSenior): void {
  updatePoolStatus(event.address)
  updatePoolInvestments(event.address, event.params.tranchedPool)
}

export function handlePrincipalCollected(event: PrincipalCollected): void {
  updatePoolStatus(event.address)
}

export function handlePrincipalWrittenDown(event: PrincipalWrittenDown): void {
  updatePoolStatus(event.address)
}

export function handleReserveFundsCollected(event: ReserveFundsCollected): void {
  updatePoolStatus(event.address)
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  updatePoolStatus(event.address)

  const stakingRewardsAddress = getStakingRewardsAddressFromSeniorPoolAddress(event.address)

  // Purposefully ignore withdrawals made by StakingRewards contract because those will be captured as UnstakeAndWithdraw
  if (!event.params.capitalProvider.equals(stakingRewardsAddress)) {
    const transaction = createTransactionFromEvent(event, "SENIOR_POOL_WITHDRAWAL", event.params.capitalProvider)

    const seniorPoolContract = SeniorPool.bind(event.address)
    const sharePrice = seniorPoolContract.sharePrice()

    transaction.sentAmount = event.params.userAmount
      .plus(event.params.reserveAmount)
      .times(FIDU_DECIMALS)
      .div(USDC_DECIMALS)
      .times(FIDU_DECIMALS)
      .div(sharePrice)
    transaction.sentToken = "FIDU"
    transaction.receivedAmount = event.params.userAmount
    transaction.receivedToken = "USDC"
    transaction.fiduPrice = sharePrice

    transaction.save()
  }
}

export function handleWithdrawalRequest(event: WithdrawalRequested): void {
  updatePoolStatus(event.address)

  // Create transaction
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_WITHDRAWAL_REQUEST", event.params.operator)
  transaction.sentAmount = event.params.fiduRequested
  transaction.sentToken = "FIDU"
  transaction.save()

  const user = getOrInitUser(event.params.operator)

  // Create withdrawal transaction
  const withdrawalTransaction = new WithdrawalTransaction(event.transaction.hash.concatI32(event.logIndex.toI32()))
  withdrawalTransaction.epochId = event.params.epochId
  withdrawalTransaction.user = user.id
  withdrawalTransaction.amount = event.params.fiduRequested
  withdrawalTransaction.category = "WITHDRAWAL_REQUEST"
  withdrawalTransaction.timestamp = event.block.timestamp.toI32()
  withdrawalTransaction.blockNumber = event.block.number.toI32()
  withdrawalTransaction.save()
}

export function handleAddToWithdrawalRequest(event: WithdrawalAddedTo): void {
  updatePoolStatus(event.address)

  // Create transaction
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_ADD_TO_WITHDRAWAL_REQUEST", event.params.operator)

  transaction.sentAmount = event.params.fiduRequested
  transaction.sentToken = "FIDU"
  transaction.save()

  const user = getOrInitUser(event.params.operator)

  // Create withdrawal transaction
  const withdrawalTransaction = new WithdrawalTransaction(event.transaction.hash.concatI32(event.logIndex.toI32()))
  withdrawalTransaction.epochId = event.params.epochId
  withdrawalTransaction.user = user.id
  withdrawalTransaction.amount = event.params.fiduRequested
  withdrawalTransaction.category = "ADD_TO_WITHDRAWAL_REQUEST"
  withdrawalTransaction.timestamp = event.block.timestamp.toI32()
  withdrawalTransaction.blockNumber = event.block.number.toI32()
  withdrawalTransaction.save()
}

export function handleWithdrawalRequestCanceled(event: WithdrawalCanceled): void {
  updatePoolStatus(event.address)

  // Create transaction
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_CANCEL_WITHDRAWAL_REQUEST", event.params.operator)
  transaction.receivedAmount = event.params.fiduCanceled
  transaction.receivedToken = "FIDU"
  transaction.save()

  // Get user
  const user = getOrInitUser(event.params.operator)

  // Create withdrawal transaction
  const withdrawalTransaction = new WithdrawalTransaction(event.transaction.hash.concatI32(event.logIndex.toI32()))
  withdrawalTransaction.epochId = event.params.epochId
  withdrawalTransaction.user = user.id
  withdrawalTransaction.amount = event.params.fiduCanceled
  withdrawalTransaction.category = "CANCEL_WITHDRAWAL_REQUEST"
  withdrawalTransaction.timestamp = event.block.timestamp.toI32()
  withdrawalTransaction.blockNumber = event.block.number.toI32()
  withdrawalTransaction.save()
}

export function handleEpochEnded(event: EpochEnded): void {
  updatePoolStatus(event.address)

  // Create transaction
  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DISTRIBUTION", event.address)
  transaction.sentAmount = event.params.fiduLiquidated
  transaction.sentToken = "FIDU"
  transaction.save()

  const epoch = new Epoch(event.params.epochId.toString())

  epoch.endsAt = event.params.endTime.toI32()
  epoch.fiduRequested = event.params.fiduRequested
  epoch.usdcAllocated = event.params.usdcAllocated
  epoch.fiduLiquidated = event.params.fiduLiquidated

  epoch.save()
}

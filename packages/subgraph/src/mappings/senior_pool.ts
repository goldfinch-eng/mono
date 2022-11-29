import {Address, BigInt} from "@graphprotocol/graph-ts"
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
import {
  SeniorPoolWithdrawalEpoch,
  SeniorPoolWithdrawalDisbursement,
  SeniorPoolWithdrawalRequest,
} from "../../generated/schema"

import {CONFIG_KEYS_ADDRESSES, FIDU_DECIMALS, USDC_DECIMALS} from "../constants"
import {createTransactionFromEvent, usdcWithFiduPrecision} from "../entities/helpers"
import {updatePoolInvestments, updatePoolStatus} from "../entities/senior_pool"
import {handleDeposit, getOrInitUser} from "../entities/user"
import {getAddressFromConfig} from "../utils"
import {getOrInitSeniorPoolWithdrawalRoster} from "../entities/withdrawal_roster"

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

  const withdrawalRequest = SeniorPoolWithdrawalRequest.load(event.params.capitalProvider.toHexString())
  if (withdrawalRequest) {
    withdrawalRequest.usdcWithdrawable = BigInt.zero()
    withdrawalRequest.save()
  }
}

export function handleWithdrawalRequest(event: WithdrawalRequested): void {
  const withdrawalRequest = new SeniorPoolWithdrawalRequest(event.params.operator.toHexString())
  withdrawalRequest.user = getOrInitUser(event.params.operator).id
  withdrawalRequest.fiduRequested = event.params.fiduRequested
  withdrawalRequest.usdcWithdrawable = BigInt.zero()
  withdrawalRequest.requestedAt = event.block.timestamp.toI32()
  withdrawalRequest.save()

  const roster = getOrInitSeniorPoolWithdrawalRoster()
  roster.requests = roster.requests.concat([withdrawalRequest.id])
  roster.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_WITHDRAWAL_REQUEST", event.params.operator)
  transaction.sentAmount = event.params.fiduRequested
  transaction.sentToken = "FIDU"
  transaction.save()
}

export function handleAddToWithdrawalRequest(event: WithdrawalAddedTo): void {
  const withdrawalRequest = assert(SeniorPoolWithdrawalRequest.load(event.params.operator.toHexString()))
  withdrawalRequest.fiduRequested = withdrawalRequest.fiduRequested.plus(event.params.fiduRequested)
  withdrawalRequest.increasedAt = event.block.timestamp.toI32()
  withdrawalRequest.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_ADD_TO_WITHDRAWAL_REQUEST", event.params.operator)
  transaction.sentAmount = event.params.fiduRequested
  transaction.sentToken = "FIDU"
  transaction.save()
}

export function handleWithdrawalRequestCanceled(event: WithdrawalCanceled): void {
  const withdrawalRequest = SeniorPoolWithdrawalRequest.load(event.params.operator.toHexString())
  if (withdrawalRequest) {
    withdrawalRequest.fiduRequested = BigInt.zero()
    withdrawalRequest.canceledAt = event.block.timestamp.toI32()
    withdrawalRequest.save()
  }

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_CANCEL_WITHDRAWAL_REQUEST", event.params.operator)
  transaction.receivedAmount = event.params.fiduCanceled
  transaction.receivedToken = "FIDU"
  transaction.save()
}

export function handleEpochEnded(event: EpochEnded): void {
  const epoch = new SeniorPoolWithdrawalEpoch(event.params.epochId.toString())
  epoch.epoch = event.params.epochId
  epoch.endsAt = event.params.endTime.toI32()
  epoch.fiduRequested = event.params.fiduRequested
  epoch.fiduLiquidated = event.params.fiduLiquidated
  epoch.usdcAllocated = event.params.usdcAllocated
  epoch.save()

  const transaction = createTransactionFromEvent(event, "SENIOR_POOL_DISTRIBUTION", event.address)
  transaction.sentAmount = epoch.usdcAllocated
  transaction.sentToken = "USDC"
  transaction.save()

  const roster = getOrInitSeniorPoolWithdrawalRoster()
  for (let i = 0; i < roster.requests.length; i++) {
    const withdrawalRequest = SeniorPoolWithdrawalRequest.load(roster.requests[i])
    if (!withdrawalRequest) {
      continue
    }

    const proRataUsdc = epoch.usdcAllocated.times(withdrawalRequest.fiduRequested).div(epoch.fiduRequested)
    const fiduLiquidated = epoch.fiduLiquidated.times(withdrawalRequest.fiduRequested).div(epoch.fiduRequested)
    withdrawalRequest.usdcWithdrawable = withdrawalRequest.usdcWithdrawable.plus(proRataUsdc)
    withdrawalRequest.fiduRequested = withdrawalRequest.fiduRequested.minus(fiduLiquidated)
    withdrawalRequest.save()

    const disbursement = new SeniorPoolWithdrawalDisbursement(`${epoch.id}-${withdrawalRequest.id}`)
    disbursement.user = withdrawalRequest.user
    disbursement.epoch = event.params.epochId
    disbursement.allocatedAt = epoch.endsAt
    disbursement.usdcAllocated = proRataUsdc
    disbursement.fiduLiquidated = fiduLiquidated
    disbursement.save()
  }
}

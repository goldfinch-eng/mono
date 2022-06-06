import {Transaction, User} from "../../generated/schema"
import {
  CreditLineMigrated,
  DepositMade,
  DrawdownsPaused,
  DrawdownsUnpaused,
  WithdrawalMade,
  TrancheLocked,
  SliceCreated,
  EmergencyShutdown,
  DrawdownMade,
  PaymentApplied,
} from "../../generated/templates/TranchedPool/TranchedPool"
import {updateAllPoolBackers, updateAllPoolBackersRewardsClaimable} from "../entities/pool_backer"
import {
  handleDeposit,
  updatePoolCreditLine,
  initOrUpdateTranchedPool,
  handleDrawdownMade as _handleDrawdownMade,
  handlePaymentApplied as _handlePaymentApplied,
  updateTranchedPoolLeverageRatio,
} from "../entities/tranched_pool"

export function handleCreditLineMigrated(event: CreditLineMigrated): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
}

export function handleDepositMade(event: DepositMade): void {
  handleDeposit(event)

  const transaction = new Transaction(event.transaction.hash)
  transaction.category = "TRANCHED_POOL_DEPOSIT"
  transaction.user = event.params.owner.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.amount
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.blockNumber = event.block.number.toI32()
  transaction.save()
}

export function handleDrawdownsPaused(event: DrawdownsPaused): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
}

export function handleDrawdownsUnpaused(event: DrawdownsUnpaused): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
  updateAllPoolBackers(event.address)

  const transaction = new Transaction(event.transaction.hash)
  transaction.category = "TRANCHED_POOL_WITHDRAWAL"
  transaction.user = event.params.owner.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.interestWithdrawn.plus(event.params.principalWithdrawn)
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.blockNumber = event.block.number.toI32()
  transaction.save()
}

export function handleTrancheLocked(event: TrancheLocked): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updateTranchedPoolLeverageRatio(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
}

export function handleSliceCreated(event: SliceCreated): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
}

export function handleEmergencyShutdown(event: EmergencyShutdown): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
}

export function handleDrawdownMade(event: DrawdownMade): void {
  // ensures that a wallet making a drawdown is correctly considered a user
  const user = new User(event.params.borrower.toHexString())
  user.save()
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
  updateAllPoolBackers(event.address)
  _handleDrawdownMade(event)

  const transaction = new Transaction(event.transaction.hash)
  transaction.category = "TRANCHED_POOL_DRAWDOWN"
  transaction.user = event.params.borrower.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.amount
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.blockNumber = event.block.number.toI32()
  transaction.save()
}

export function handlePaymentApplied(event: PaymentApplied): void {
  // ensures that a wallet making a payment is correctly considered a user
  const user = new User(event.params.payer.toHexString())
  user.save()
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
  _handlePaymentApplied(event)
  updateAllPoolBackersRewardsClaimable(event.address, event.block.timestamp)

  const transaction = new Transaction(event.transaction.hash)
  transaction.category = "TRANCHED_POOL_REPAYMENT"
  transaction.user = event.params.payer.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.principalAmount
    .plus(event.params.interestAmount)
    .plus(event.params.remainingAmount)
    .plus(event.params.reserveAmount)
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.blockNumber = event.block.number.toI32()
  transaction.save()
}

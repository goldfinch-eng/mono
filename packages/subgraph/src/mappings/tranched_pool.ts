import {
  CreditLineMigrated,
  DepositMade,
  DrawdownsPaused,
  DrawdownsUnpaused,
  WithdrawalMade,
  TrancheLocked,
  SliceCreated,
  EmergencyShutdown,
  GoldfinchConfigUpdated,
  DrawdownMade,
  PaymentApplied,
} from "../../generated/templates/TranchedPool/TranchedPool"
import {updateAllPoolBackers} from "../entities/pool_backer"
import {
  handleDeposit,
  updatePoolCreditLine,
  initOrUpdateTranchedPool,
  handleDrawdownMade as _handleDrawdownMade,
  handlePaymentApplied as _handlePaymentApplied,
} from "../entities/tranched_pool"

export function handleCreditLineMigrated(event: CreditLineMigrated): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handleDepositMade(event: DepositMade): void {
  handleDeposit(event)
}

export function handleDrawdownsPaused(event: DrawdownsPaused): void {
  initOrUpdateTranchedPool(event.address)
}

export function handleDrawdownsUnpaused(event: DrawdownsUnpaused): void {
  initOrUpdateTranchedPool(event.address)
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
  updateAllPoolBackers(event.address)
}

export function handleTrancheLocked(event: TrancheLocked): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handleSliceCreated(event: SliceCreated): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handleEmergencyShutdown(event: EmergencyShutdown): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handleGoldfinchConfigUpdated(event: GoldfinchConfigUpdated): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handleDrawdownMade(event: DrawdownMade): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
  updateAllPoolBackers(event.address)
  _handleDrawdownMade(event)
}

export function handlePaymentApplied(event: PaymentApplied): void {
  initOrUpdateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
  _handlePaymentApplied(event)
}

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
import { updatePoolBacker } from "../entities/pool_backer"
import { handleDeposit, updatePoolCreditLine, updateTranchedPool } from "../entities/tranched_pool"

export function handleCreditLineMigrated(event: CreditLineMigrated): void {
  updatePoolCreditLine(event.address)
}

export function handleDepositMade(event: DepositMade): void {
  handleDeposit(event)
  updatePoolCreditLine(event.address)
}

export function handleDrawdownsPaused(event: DrawdownsPaused): void {
  updateTranchedPool(event.address)
}

export function handleDrawdownsUnpaused(event: DrawdownsUnpaused): void {
  updateTranchedPool(event.address)
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  updateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
  updatePoolBacker(event.params.owner, event.params.tokenId)
}

export function handleTrancheLocked(event: TrancheLocked): void {
  updateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handleSliceCreated(event: SliceCreated): void {
  updateTranchedPool(event.address)
}

export function handleEmergencyShutdown(event: EmergencyShutdown): void {
  updateTranchedPool(event.address)
}

export function handleGoldfinchConfigUpdated(event: GoldfinchConfigUpdated): void {
  updateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handleDrawdownMade(event: DrawdownMade): void {
  updateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

export function handlePaymentApplied(event: PaymentApplied): void {
  updateTranchedPool(event.address)
  updatePoolCreditLine(event.address)
}

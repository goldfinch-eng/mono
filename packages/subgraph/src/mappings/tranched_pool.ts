import {Address} from "@graphprotocol/graph-ts"
import {TranchedPool, User} from "../../generated/schema"
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
import {SENIOR_POOL_ADDRESS} from "../constants"
import {createTransactionFromEvent} from "../entities/helpers"
import {updateAllPoolBackers, updateAllPoolBackersRewardsClaimable} from "../entities/pool_backer"
import {
  handleDeposit,
  updatePoolCreditLine,
  initOrUpdateTranchedPool,
  updateTranchedPoolLeverageRatio,
} from "../entities/tranched_pool"
import {createZapMaybe, deleteZapAfterUnzapMaybe} from "../entities/zapper"

export function handleCreditLineMigrated(event: CreditLineMigrated): void {
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
}

export function handleDepositMade(event: DepositMade): void {
  handleDeposit(event)

  const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_DEPOSIT")
  transaction.user = event.params.owner.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.amount
  transaction.save()

  createZapMaybe(event)
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

  const transaction = createTransactionFromEvent(
    event,
    event.params.owner.equals(Address.fromString(SENIOR_POOL_ADDRESS))
      ? "SENIOR_POOL_REDEMPTION"
      : "TRANCHED_POOL_WITHDRAWAL"
  )
  transaction.transactionHash = event.transaction.hash
  transaction.user = event.params.owner.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.interestWithdrawn.plus(event.params.principalWithdrawn)
  transaction.save()

  deleteZapAfterUnzapMaybe(event)
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

  const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_DRAWDOWN")
  transaction.user = event.params.borrower.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.amount
  transaction.save()
}

export function handlePaymentApplied(event: PaymentApplied): void {
  // ensures that a wallet making a payment is correctly considered a user
  const user = new User(event.params.payer.toHexString())
  user.save()
  initOrUpdateTranchedPool(event.address, event.block.timestamp)
  updatePoolCreditLine(event.address, event.block.timestamp)
  updateAllPoolBackersRewardsClaimable(event.address, event.block.timestamp)

  const tranchedPool = assert(TranchedPool.load(event.address.toHexString()))
  tranchedPool.principalAmountRepaid = tranchedPool.principalAmountRepaid.plus(event.params.principalAmount)
  tranchedPool.interestAmountRepaid = tranchedPool.interestAmountRepaid.plus(event.params.interestAmount)
  tranchedPool.save()

  const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_REPAYMENT")
  transaction.user = event.params.payer.toHexString()
  transaction.tranchedPool = event.address.toHexString()
  transaction.amount = event.params.principalAmount.plus(event.params.interestAmount)
  transaction.save()
}

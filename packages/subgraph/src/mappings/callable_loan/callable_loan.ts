import {Address} from "@graphprotocol/graph-ts"
import {CallableLoan, PoolToken} from "../../../generated/schema"
import {
  CallableLoan as CallableLoanContract,
  CallRequestSubmitted,
  DepositMade,
  DrawdownMade,
  PaymentApplied,
  WithdrawalMade,
} from "../../../generated/templates/CallableLoan/CallableLoan"
import {createTransactionFromEvent} from "../../entities/helpers"
import {
  updateTotalInterestCollected,
  updateTotalPrincipalCollected,
  updateTotalReserveCollected,
} from "../../entities/protocol"
import {getOrInitUser} from "../../entities/user"
import {
  deleteCallableLoanRepaymentSchedule,
  generateRepaymentScheduleForCallableLoan,
  updatePoolTokensRedeemable,
} from "./helpers"

function getCallableLoan(address: Address): CallableLoan {
  return assert(CallableLoan.load(address.toHexString()))
}

export function handleDepositMade(event: DepositMade): void {
  const callableLoan = getCallableLoan(event.address)
  callableLoan.totalDeposited = callableLoan.totalDeposited.plus(event.params.amount)
  const user = getOrInitUser(event.params.owner)
  callableLoan.backers = callableLoan.backers.concat([user.id])
  callableLoan.numBackers = callableLoan.backers.length
  callableLoan.save()

  const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_DEPOSIT", event.params.owner)
  transaction.loan = event.address.toHexString()
  transaction.sentToken = "USDC"
  transaction.sentAmount = event.params.amount
  transaction.save()
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  const callableLoan = getCallableLoan(event.address)
  callableLoan.totalDeposited = callableLoan.totalDeposited.minus(event.params.principalWithdrawn)
  callableLoan.save()

  const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_WITHDRAWAL", event.params.owner)
  transaction.loan = event.address.toHexString()
  transaction.receivedToken = "USDC"
  transaction.receivedAmount = event.params.interestWithdrawn.plus(event.params.principalWithdrawn)
  transaction.save()
}

export function handleDrawdownMade(event: DrawdownMade): void {
  const callableLoan = getCallableLoan(event.address)
  updatePoolTokensRedeemable(callableLoan) // Results of availableToWithdraw change after the pool is drawn down (they become 0)
  const callableLoanContract = CallableLoanContract.bind(event.address)
  callableLoan.principalAmount = event.params.amount
  callableLoan.balance = callableLoanContract.balance()
  callableLoan.termStartTime = callableLoanContract.termStartTime()
  callableLoan.termEndTime = callableLoanContract.termEndTime()
  deleteCallableLoanRepaymentSchedule(callableLoan)
  const schedulingResult = generateRepaymentScheduleForCallableLoan(callableLoan)
  callableLoan.repaymentSchedule = schedulingResult.repaymentIds
  callableLoan.numRepayments = schedulingResult.repaymentIds.length
  callableLoan.termInSeconds = schedulingResult.termInSeconds
  callableLoan.repaymentFrequency = schedulingResult.repaymentFrequency
  callableLoan.save()

  const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_DRAWDOWN", event.params.borrower)
  transaction.loan = event.address.toHexString()
  transaction.receivedToken = "USDC"
  transaction.receivedAmount = event.params.amount
  transaction.save()
}

export function handlePaymentApplied(event: PaymentApplied): void {
  const callableLoan = getCallableLoan(event.address)
  updatePoolTokensRedeemable(callableLoan) // Results of availableToWithdraw change after a repayment is made (principal or interest can increase)
  callableLoan.balance = callableLoan.balance.minus(event.params.principal)
  callableLoan.principalAmountRepaid = callableLoan.principalAmountRepaid.plus(event.params.principal)
  callableLoan.interestAmountRepaid = callableLoan.interestAmountRepaid.plus(event.params.interest)
  callableLoan.save()

  updateTotalPrincipalCollected(event.params.principal)
  updateTotalInterestCollected(event.params.interest)
  updateTotalReserveCollected(event.params.reserve)

  const transaction = createTransactionFromEvent(event, "TRANCHED_POOL_REPAYMENT", event.params.payer)
  transaction.loan = event.address.toHexString()
  transaction.sentToken = "USDC"
  transaction.sentAmount = event.params.principal.plus(event.params.interest)
  transaction.save()
}

export function handleCallRequestSubmitted(event: CallRequestSubmitted): void {
  const callableLoanContract = CallableLoanContract.bind(event.address)
  const poolToken = assert(PoolToken.load(event.params.callRequestedTokenId.toString()))
  poolToken.isCapitalCalled = true
  poolToken.calledAt = event.block.timestamp.toI32()
  poolToken.callDueAt = callableLoanContract.nextPrincipalDueTime().toI32()
  poolToken.save()

  const transaction = createTransactionFromEvent(event, "CALL_REQUEST_SUBMITTED", Address.fromString(poolToken.user))
  transaction.loan = event.address.toHexString()
  transaction.receivedToken = "USDC"
  transaction.receivedAmount = event.params.callAmount
  transaction.save()
}

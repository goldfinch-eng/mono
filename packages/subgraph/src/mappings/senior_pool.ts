import {Transaction} from "../../generated/schema"
import {
  DepositMade,
  InterestCollected,
  InvestmentMadeInJunior,
  InvestmentMadeInSenior,
  PrincipalCollected,
  PrincipalWrittenDown,
  ReserveFundsCollected,
  WithdrawalMade,
} from "../../generated/templates/SeniorPool/SeniorPool"
import {updatePoolInvestments, updatePoolStatus} from "../entities/senior_pool"
import {handleDeposit} from "../entities/user"

export function handleDepositMade(event: DepositMade): void {
  updatePoolStatus(event.address)
  handleDeposit(event)

  const transaction = new Transaction(event.transaction.hash)
  transaction.category = "SENIOR_POOL_DEPOSIT"
  transaction.user = event.params.capitalProvider.toHexString()
  transaction.amount = event.params.amount
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.blockNumber = event.block.number.toI32()
  transaction.save()
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

  const transaction = new Transaction(event.transaction.hash)
  transaction.category = "SENIOR_POOL_WITHDRAWAL"
  transaction.user = event.params.capitalProvider.toHexString()
  transaction.amount = event.params.userAmount
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.blockNumber = event.block.number.toI32()
  transaction.save()
}

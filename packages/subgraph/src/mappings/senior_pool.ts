import {
  DepositMade,
  InterestCollected,
  InvestmentMadeInJunior,
  InvestmentMadeInSenior,
  Paused,
  PrincipalCollected,
  PrincipalWrittenDown,
  ReserveFundsCollected,
  RoleGranted,
  RoleRevoked,
  Unpaused,
  WithdrawalMade
} from "../../generated/templates/SeniorPool/SeniorPool"
import { updatePoolCapitalProviders, updatePoolStatus } from '../entities/senior_pool';
import { handleDeposit, updateCapitalProviders, updateUser } from "../entities/user";


export function handleDepositMade(event: DepositMade): void {
  updatePoolCapitalProviders(event.address, event.params.capitalProvider)
  updatePoolStatus(event.address)
  handleDeposit(event)
}

export function handleInterestCollected(event: InterestCollected): void {
  updatePoolStatus(event.address)
  updateCapitalProviders(event.address)
}

export function handleInvestmentMadeInJunior(
  event: InvestmentMadeInJunior
): void {
  updatePoolStatus(event.address)
}

export function handleInvestmentMadeInSenior(
  event: InvestmentMadeInSenior
): void {
  updatePoolStatus(event.address)
}

export function handlePrincipalCollected(event: PrincipalCollected): void {
  updatePoolStatus(event.address)
  updateCapitalProviders(event.address)
}

export function handlePrincipalWrittenDown(event: PrincipalWrittenDown): void {
  updatePoolStatus(event.address)
  updateCapitalProviders(event.address)
}

export function handleReserveFundsCollected(
  event: ReserveFundsCollected
): void {
  updatePoolStatus(event.address)
}

export function handleWithdrawalMade(event: WithdrawalMade): void {
  updatePoolStatus(event.address)
  updateUser(event.address, event.params.capitalProvider)
}

export function handleRoleGranted(event: RoleGranted): void {}

export function handleRoleRevoked(event: RoleRevoked): void {}

export function handleUnpaused(event: Unpaused): void {}

export function handlePaused(event: Paused): void {}

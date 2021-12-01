import {
  CreditLineMigrated,
  DepositMade,
  DrawdownsPaused,
  DrawdownsUnpaused,
  WithdrawalMade,
} from "../../generated/templates/TranchedPool/TranchedPool"

export function handlerCreditLineMigrated(event: CreditLineMigrated): void {}

export function handlerDepositMade(event: DepositMade): void {}

export function handlerDrawdownsPaused(event: DrawdownsPaused): void {}

export function handlerDrawdownsUnpaused(event: DrawdownsUnpaused): void {}

export function handlerWithdrawalMade(event: WithdrawalMade): void {}

import {
  CreditLineMigrated,
  DepositMade,
  DrawdownsPaused,
  DrawdownsUnpaused,
  WithdrawalMade,
} from "../../generated/templates/TranchedPool/TranchedPool"

export function handleCreditLineMigrated(event: CreditLineMigrated): void {}

export function handleDepositMade(event: DepositMade): void {}

export function handleDrawdownsPaused(event: DrawdownsPaused): void {}

export function handleDrawdownsUnpaused(event: DrawdownsUnpaused): void {}

export function handleWithdrawalMade(event: WithdrawalMade): void {}

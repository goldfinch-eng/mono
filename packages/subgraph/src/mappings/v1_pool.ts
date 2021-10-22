import { log } from "@graphprotocol/graph-ts";
import {
  DepositMade,
  InterestCollected,
  Paused,
  PrincipalCollected,
  PrincipalWrittendown,
  ReserveFundsCollected,
  RoleGranted,
  RoleRevoked,
  TransferMade,
  Unpaused,
  WithdrawalMade
} from "../../generated/templates/Pool/Pool"

import {handleDepositForV1} from "../entities/user"


export function handleDepositMade(event: DepositMade): void {
  handleDepositForV1(event)
}

export function handleInterestCollected(event: InterestCollected): void { }

export function handlePrincipalCollected(event: PrincipalCollected): void { }

export function handlePrincipalWrittendown(event: PrincipalWrittendown): void {}

export function handleReserveFundsCollected(
    event: ReserveFundsCollected
): void { }

export function handleWithdrawalMade(event: WithdrawalMade): void { }

export function handleRoleGranted(event: RoleGranted): void { }

export function handleRoleRevoked(event: RoleRevoked): void { }

export function handleUnpaused(event: Unpaused): void { }

export function handlePaused(event: Paused): void { }

export function handleTransferMade(event: TransferMade): void { }
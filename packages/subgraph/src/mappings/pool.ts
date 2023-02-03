import {
  updateTotalInterestCollected,
  updateTotalPrincipalCollected,
  updateTotalWriteDowns,
} from "../entities/tranched_pool_roster"
import {PrincipalCollected, InterestCollected, PrincipalWrittendown} from "../../generated/Pool/Pool"

export function handlePrincipalCollected(event: PrincipalCollected): void {
  updateTotalPrincipalCollected(event.params.amount)
}

export function handleInterestCollected(event: InterestCollected): void {
  updateTotalInterestCollected(event.params.poolAmount)
}

export function handlePrincipalWrittendown(event: PrincipalWrittendown): void {
  updateTotalWriteDowns(event.params.amount)
}

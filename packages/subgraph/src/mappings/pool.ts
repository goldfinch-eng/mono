import {updateTotalInterestCollected, updateTotalPrincipalCollected, updateTotalWriteDowns} from "../entities/protocol"
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

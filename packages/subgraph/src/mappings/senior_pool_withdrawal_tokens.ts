import {Bytes, store} from "@graphprotocol/graph-ts"
import {SeniorPoolWithdrawalRequest} from "../../generated/schema"
import {Transfer} from "../../generated/WithdrawalRequestToken/WithdrawalRequestToken"
import {getOrInitSeniorPoolWithdrawalRoster} from "../entities/withdrawal_roster"
import {removeFromList} from "../utils"

// It's important to keep in mind that these withdrawal tokens are non-transferable. This event will only be emitted on:
// 1. Mint, wherein the creation of a SeniorPoolWithdrawalRequest subgraph entity is handled by handleWithdrawalRequested()
// 2. Burn, wherein the deletion of a SeniorPoolWithdrawalRequest subgraph entity is handled here
export function handleTransfer(event: Transfer): void {
  const withdrawalRequest = SeniorPoolWithdrawalRequest.load(event.params.from.toHexString())
  if (!withdrawalRequest) {
    return
  }
  // handles burning of withdrawal tokens, which can occur during the lifecycle of withdrawal requests and epochs
  if (event.params.to.equals(Bytes.fromHexString("0x0000000000000000000000000000000000000000"))) {
    store.remove("SeniorPoolWithdrawalRequest", withdrawalRequest.id)
    const roster = getOrInitSeniorPoolWithdrawalRoster()
    roster.requests = removeFromList(roster.requests, withdrawalRequest.id)
    roster.save()
  }
}

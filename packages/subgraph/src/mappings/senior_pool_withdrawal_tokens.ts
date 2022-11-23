import {Bytes, store} from "@graphprotocol/graph-ts"
import {SeniorPoolWithdrawalRequestToken} from "../../generated/schema"
import {Transfer} from "../../generated/WithdrawalRequestToken/WithdrawalRequestToken"
import {getOrInitUser} from "../entities/user"
import {getOrInitSeniorPoolWithdrawalRoster} from "../entities/withdrawal_roster"
import {removeFromList} from "../utils"

export function handleTransfer(event: Transfer): void {
  const token = SeniorPoolWithdrawalRequestToken.load(event.params.tokenId.toString())
  if (!token) {
    return
  }
  // handles burning of withdrawal tokens, which can occur during the lifecycle of withdrawal requests and epochs
  if (event.params.to.equals(Bytes.fromHexString("0x0000000000000000000000000000000000000000"))) {
    store.remove("SeniorPoolWithdrawalRequestToken", token.id)
    const roster = getOrInitSeniorPoolWithdrawalRoster()
    roster.requests = removeFromList(roster.requests, token.id)
    roster.save()
  } else {
    token.user = getOrInitUser(event.params.to).id
    token.save()
  }
}

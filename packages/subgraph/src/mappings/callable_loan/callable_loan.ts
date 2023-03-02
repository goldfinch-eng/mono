import {CallableLoan} from "../../../generated/schema"
import {DepositMade} from "../../../generated/templates/CallableLoan/CallableLoan"
import {getOrInitUser} from "../../entities/user"

export function handleDepositMade(event: DepositMade): void {
  const callableLoan = assert(CallableLoan.load(event.address.toHexString()))
  callableLoan.totalDeposited = callableLoan.totalDeposited.plus(event.params.amount)
  const user = getOrInitUser(event.params.owner)
  callableLoan.backers = callableLoan.backers.concat([user.id])
  callableLoan.numBackers = callableLoan.backers.length
  callableLoan.save()
}

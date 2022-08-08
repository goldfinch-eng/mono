import {Address} from "@graphprotocol/graph-ts"
import {User} from "../../generated/schema"
import {DepositMade} from "../../generated/templates/SeniorPool/SeniorPool"
import {DepositMade as V1DepositMade} from "../../generated/templates/Pool/Pool"

export function getOrInitUser(address: Address): User {
  let user = User.load(address.toHexString())
  if (!user) {
    user = new User(address.toHexString())
    user.isGoListed = false
    user.type = "CAPITAL_PROVIDER"
    user.save()
  }
  return user as User
}

export function handleDeposit(event: DepositMade): void {
  let userAddress = event.params.capitalProvider
  // Just adds a corresponding user entity to the database
  getOrInitUser(userAddress)
}

export function handleDepositForV1(event: V1DepositMade): void {
  let userAddress = event.params.capitalProvider
  // Just adds a corresponding user entity to the database
  getOrInitUser(userAddress)
}

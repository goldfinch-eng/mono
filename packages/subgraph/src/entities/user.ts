import {Address} from "@graphprotocol/graph-ts"
import {User} from "../../generated/schema"
import {DepositMade} from "../../generated/SeniorPool/SeniorPool"

export function getOrInitUser(address: Address): User {
  let user = User.load(address.toHexString())
  if (!user) {
    user = new User(address.toHexString())
    user.uidType = null
    user.isGoListed = false
    user.poolTokens = []
    user.save()
  }
  return user
}

export function handleDeposit(event: DepositMade): void {
  const userAddress = event.params.capitalProvider
  // Just adds a corresponding user entity to the database
  getOrInitUser(userAddress)
}

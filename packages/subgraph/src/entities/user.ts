import {Address, BigInt} from "@graphprotocol/graph-ts"
import {User, SeniorPoolDeposit} from "../../generated/schema"
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
  let user = getOrInitUser(userAddress)
  let deposit = new SeniorPoolDeposit(event.transaction.hash.toHexString())
  deposit.user = user.id
  deposit.amount = event.params.amount
  deposit.shares = event.params.shares
  deposit.blockNumber = event.block.number
  deposit.timestamp = event.block.timestamp
  deposit.save()
}

export function handleDepositForV1(event: V1DepositMade): void {
  let userAddress = event.params.capitalProvider
  let user = getOrInitUser(userAddress)
  let deposit = new SeniorPoolDeposit(event.transaction.hash.toHexString())
  deposit.user = user.id
  deposit.amount = event.params.amount
  deposit.shares = event.params.shares
  deposit.blockNumber = event.block.number
  deposit.timestamp = event.block.timestamp
  deposit.save()
}

export function updateStakedSeniorPoolBalance(userAddress: Address, amountStaked: BigInt): void {
  const user = getOrInitUser(userAddress)
  user.stakedSeniorPoolBalance = user.stakedSeniorPoolBalance.plus(amountStaked)
  user.save()
}

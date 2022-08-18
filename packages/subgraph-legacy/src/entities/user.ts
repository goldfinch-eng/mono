import { Address, BigDecimal, BigInt, crypto } from '@graphprotocol/graph-ts';
import { User, CapitalProviderStatus, SeniorPoolDeposit } from "../../generated/schema"
import { DepositMade, SeniorPool as SeniorPoolContract } from '../../generated/templates/SeniorPool/SeniorPool';
import {DepositMade as V1DepositMade} from "../../generated/templates/Pool/Pool"
import {
  Fidu_Implementation as FiduContract,
} from "../../generated/templates/SeniorPool/Fidu_Implementation"
import { getOrInitSeniorPool } from './senior_pool';

import { FIDU_ADDRESS } from '../constants';


function getWeightedAverageSharePrice(address: Address): BigDecimal {
  let BIG_INT_1E18 = BigInt.fromString('10').pow(18)
  let BIG_INT_1E6 = BigInt.fromString('10').pow(6)
  let user = User.load(address.toHexString()) as User
  let capitalProvider = CapitalProviderStatus.load(user.capitalProviderStatus as string) as CapitalProviderStatus
  let sharesLeftToAccountFor = capitalProvider.numShares
  let zero = new BigInt(0)
  let totalAmountPaid = zero

  for (let i = 0; i < (user.seniorPoolDeposits as string[]).length; i++) {
    if (sharesLeftToAccountFor.lt(zero) || sharesLeftToAccountFor == zero) {
      return zero.toBigDecimal()
    }

    let sharesToAccountFor: BigInt
    let depositAddress = (user.seniorPoolDeposits as string[])[i]
    let deposit = SeniorPoolDeposit.load(depositAddress) as SeniorPoolDeposit
    let sharePrice = deposit.amount.div(BIG_INT_1E6).div(deposit.shares).div(BIG_INT_1E18)

    if (sharesLeftToAccountFor <= deposit.shares) {
      sharesToAccountFor = sharesLeftToAccountFor
    } else {
      sharesToAccountFor = deposit.shares
    }

    totalAmountPaid = totalAmountPaid.plus(sharesToAccountFor.times(sharePrice))
    sharesLeftToAccountFor = sharesLeftToAccountFor.minus(sharesToAccountFor)
  }
  if (sharesLeftToAccountFor.gt(zero)) {
    // This case means you must have received Fidu outside of depositing,
    // which we don't have price data for, and therefore can't calculate
    // a correct weighted average price. By returning empty string,
    // the result becomes NaN, and our display functions automatically handle
    // the case, and turn it into a '-' on the front-end
    return zero.toBigDecimal()
  }
  return totalAmountPaid.divDecimal(capitalProvider.numShares.toBigDecimal())
}


export function getOrInitUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (!user) {
    user = new User(address.toHexString())
    user.goListed = true
    user.type = "CAPITAL_PROVIDER"
    user.save()

    let zero = new BigInt(0)
    let status = new CapitalProviderStatus(address.toHexString() + '1')
    status.user = user.id
    status.numShares = zero
    status.availableToWithdraw = zero
    status.availableToWithdrawInDollars = zero
    status.allowance = zero
    status.save()

    user.capitalProviderStatus = status.id
    user.save()
  }
  return user as User
}

export function updateCapitalProviders(seniorPoolAddress: Address): void {
  let seniorPool = getOrInitSeniorPool(seniorPoolAddress)
  let seniorPoolCapitalProviders = seniorPool.capitalProviders

  for (let i = 0; i < seniorPoolCapitalProviders.length; i++) {
    let address = seniorPoolCapitalProviders[0]
    updateUser(seniorPoolAddress, Address.fromString(address))
  }
}

export function updateUser(seniorPoolAddress: Address, userAddress: Address): void {
  let fidu_contract = FiduContract.bind(Address.fromString(FIDU_ADDRESS))
  let user = getOrInitUser(userAddress)

  let contract = SeniorPoolContract.bind(seniorPoolAddress)
  let sharePrice = contract.sharePrice()
  let numShares = fidu_contract.balanceOf(userAddress)
  let availableToWithdraw = numShares.times(sharePrice)
  let allowance = fidu_contract.allowance(userAddress, seniorPoolAddress)

  let status = CapitalProviderStatus.load(user.capitalProviderStatus as string) as CapitalProviderStatus
  status.numShares = numShares
  status.availableToWithdraw = availableToWithdraw
  status.allowance = allowance
  status.save()
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
  updateUser(event.address, userAddress)
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

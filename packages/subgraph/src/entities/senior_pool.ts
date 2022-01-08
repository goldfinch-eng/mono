import { Address, BigInt } from '@graphprotocol/graph-ts';
import { SeniorPool, SeniorPoolStatus } from "../../generated/schema"
import { SeniorPool as SeniorPoolContract } from '../../generated/templates/SeniorPool/SeniorPool';
import {
  Fidu_Implementation as FiduContract,
} from "../../generated/templates/SeniorPool/Fidu_Implementation"
import { FIDU_ADDRESS } from '../constants';


export function getOrInitSeniorPool(address: Address): SeniorPool {
  let seniorPool = SeniorPool.load(address.toHexString());
  if (!seniorPool) {
    seniorPool = new SeniorPool(address.toHexString())
		seniorPool.capitalProviders = []
    seniorPool.investmentsMade = []

    let poolStatus = new SeniorPoolStatus('1')
    poolStatus.rawBalance = new BigInt(0)
    poolStatus.compoundBalance = new BigInt(0)
    poolStatus.balance = new BigInt(0)
    poolStatus.totalShares = new BigInt(0)
    poolStatus.sharePrice = new BigInt(0)
    poolStatus.totalPoolAssets = new BigInt(0)
    poolStatus.totalLoansOutstanding = new BigInt(0)
    poolStatus.cumulativeWritedowns = new BigInt(0)
    poolStatus.cumulativeDrawdowns = new BigInt(0)
    poolStatus.estimatedTotalInterest = new BigInt(0)
    poolStatus.estimatedApy = new BigInt(0)
    poolStatus.defaultRate = new BigInt(0)
    poolStatus.save()

    seniorPool.latestPoolStatus = poolStatus.id
    seniorPool.save()
  }
  return seniorPool as SeniorPool
}

export function updatePoolCapitalProviders(seniorPoolAddress: Address, userAddress: Address): void {
  let seniorPool = getOrInitSeniorPool(seniorPoolAddress)
  let seniorPoolCapitalProviders = seniorPool.capitalProviders
  seniorPoolCapitalProviders.push(userAddress.toHexString())
  seniorPool.capitalProviders = seniorPoolCapitalProviders
  seniorPool.save()
}

export function updatePoolStatus(seniorPoolAddress: Address): void {
  let seniorPool = getOrInitSeniorPool(seniorPoolAddress)
  let fidu_contract = FiduContract.bind(Address.fromString(FIDU_ADDRESS))

  let contract = SeniorPoolContract.bind(seniorPoolAddress)
  let sharePrice = contract.sharePrice()
  let compoundBalance = contract.compoundBalance()
  let totalLoansOutstanding = contract.totalLoansOutstanding()
  let totalSupply = fidu_contract.totalSupply()
  let totalPoolAssets = totalSupply.times(sharePrice)
  let balance = contract.assets().minus(contract.totalLoansOutstanding()).plus(contract.totalWritedowns())
  let rawBalance = balance

  let poolStatus = SeniorPoolStatus.load(seniorPool.latestPoolStatus) as SeniorPoolStatus
  poolStatus.compoundBalance = compoundBalance
  poolStatus.totalLoansOutstanding = totalLoansOutstanding
  poolStatus.totalShares = totalSupply
  poolStatus.balance = balance
  poolStatus.sharePrice = sharePrice
  poolStatus.rawBalance = rawBalance
  poolStatus.totalPoolAssets = totalPoolAssets
  poolStatus.save()

  seniorPool.latestPoolStatus = poolStatus.id
  seniorPool.save()
}

export function updatePoolInvestments(seniorPoolAddress: Address, tranchedPoolAddress: Address): void {
  let seniorPool = getOrInitSeniorPool(seniorPoolAddress)
  let investments = seniorPool.investmentsMade
  investments.push(tranchedPoolAddress.toHexString())
  seniorPool.investmentsMade = investments
  seniorPool.save()
}

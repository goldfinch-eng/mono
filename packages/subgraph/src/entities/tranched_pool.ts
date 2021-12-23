import { Address, BigInt } from '@graphprotocol/graph-ts'
import { TranchedPool, JuniorTrancheInfo, SeniorTrancheInfo, PoolBacker, TranchedPoolDeposit } from "../../generated/schema"
import { DepositMade } from "../../generated/templates/TranchedPool/TranchedPool"
import { SeniorPool as SeniorPoolContract } from '../../generated/templates/GoldfinchFactory/SeniorPool'
import { TranchedPool as TranchedPoolContract } from '../../generated/templates/GoldfinchFactory/TranchedPool'
import { GoldfinchConfig as GoldfinchConfigContract } from '../../generated/templates/GoldfinchFactory/GoldfinchConfig'
import { GOLDFINCH_CONFIG_ADDRESS, SENIOR_POOL_ADDRESS } from '../constants'
import { getOrInitUser } from './user'
import { getOrInitCreditLine, initOrUpdateCreditLine } from './credit_line'

const FIDU_DECIMAL_PLACES = 18
const FIDU_DECIMALS = BigInt.fromI32(10).pow(FIDU_DECIMAL_PLACES as u8)
const ReserveDenominatorIndex = 3
const LeverageRatioIndex = 9

function fiduFromAtomic(amount: BigInt): BigInt {
  return amount.div(FIDU_DECIMALS)
}

export function getOrInitTranchedPool(poolAddress: Address): TranchedPool {
  let tranchedPool = TranchedPool.load(poolAddress.toHexString())
  if (!tranchedPool) {
    tranchedPool = updateTranchedPool(poolAddress)

    const contract = TranchedPoolContract.bind(poolAddress)
    const creditLineAddress = contract.creditLine().toHexString()
    const creditLine = getOrInitCreditLine(Address.fromString(creditLineAddress))

    tranchedPool.creditLine = creditLine.id
    tranchedPool.save()
  }
  return tranchedPool
}

function getTotalDeposited(address: Address, juniorTranches: JuniorTrancheInfo[], seniorTranches: SeniorTrancheInfo[]): BigInt {
  let totalDeposited = new BigInt(0)

  for (let i = 0, k = juniorTranches.length; i < k; ++i) {
    let jrTranche = juniorTranches[i]
    let srTranche = seniorTranches[i]

    if (!jrTranche || !srTranche) {
      throw new Error(`Missing tranche information for ${address.toHexString()}`)
    }

    totalDeposited = totalDeposited.plus(jrTranche.principalDeposited)
    totalDeposited = totalDeposited.plus(srTranche.principalDeposited)

  }
  return totalDeposited
}

function getEstimatedTotalAssets(address: Address, juniorTranches: JuniorTrancheInfo[], seniorTranches: SeniorTrancheInfo[]): BigInt {
  let totalAssets = new BigInt(0)
  totalAssets = getTotalDeposited(address, juniorTranches, seniorTranches)

  let seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  let estimatedSeniorPoolContribution = seniorPoolContract.estimateInvestment(address)
  totalAssets = totalAssets.plus(estimatedSeniorPoolContribution)
  return totalAssets
}

function getEstimatedLeverageRatio(address: Address, juniorTranches: JuniorTrancheInfo[], seniorTranches: SeniorTrancheInfo[]): BigInt {
  let juniorContribution = new BigInt(0)

  for (let i = 0, k = juniorTranches.length; i < k; ++i) {
    let tranche = juniorTranches[i]
    if (tranche) {
      juniorContribution = juniorContribution.plus(tranche.principalDeposited)
    }
  }

  if (juniorContribution.isZero()) {
    const configContract = GoldfinchConfigContract.bind(Address.fromString(GOLDFINCH_CONFIG_ADDRESS))
    const rawLeverageRatio = configContract.getNumber(BigInt.fromI32(LeverageRatioIndex))
    return fiduFromAtomic(rawLeverageRatio)
  }

  const totalAssets = getEstimatedTotalAssets(address, juniorTranches, seniorTranches)
  const estimatedLeverageRatio = totalAssets.minus(juniorContribution).div(juniorContribution)
  return estimatedLeverageRatio
}

export function handleDeposit(event: DepositMade): void {
  const userAddress = event.params.owner
  const user = getOrInitUser(userAddress)

  let tranchedPool = getOrInitTranchedPool(event.address)
  let deposit = new TranchedPoolDeposit(event.transaction.hash.toHexString())
  deposit.user = user.id
  deposit.amount = event.params.amount
  deposit.tranchedPool = tranchedPool.id
  deposit.tranche = event.params.tranche
  deposit.tokenId = event.params.tokenId
  deposit.blockNumber = event.block.number
  deposit.timestamp = event.block.timestamp
  deposit.save()
}

export function updateTranchedPool(address: Address): TranchedPool {
  let tranchedPool = new TranchedPool(address.toHexString())
  const poolContract = TranchedPoolContract.bind(address)

  let numSlices = BigInt.fromI32(1) // TODO update here to support version of tranched pool with multiples slices

  let counter = 1
  let juniorTranches: JuniorTrancheInfo[] = []
  let seniorTranches: SeniorTrancheInfo[] = []
  for (let i = 0; i < numSlices.toI32(); i++) {
    const seniorTrancheInfo = poolContract.getTranche(BigInt.fromI32(counter))
    const seniorId = `${address.toHexString()}-${seniorTrancheInfo.id.toString()}`
    let seniorTranche = SeniorTrancheInfo.load(seniorId)
    if (!seniorTranche) {
      seniorTranche = new SeniorTrancheInfo(seniorId)
    }
    seniorTranche.trancheId =  BigInt.fromI32(counter)
    seniorTranche.lockedUntil = seniorTrancheInfo.lockedUntil
    seniorTranche.tranchedPool = address.toHexString()
    seniorTranche.principalDeposited = seniorTrancheInfo.principalDeposited
    seniorTranche.principalSharePrice = seniorTrancheInfo.principalSharePrice
    seniorTranche.interestSharePrice = seniorTrancheInfo.interestSharePrice
    seniorTranche.save()
    seniorTranches.push(seniorTranche)

    counter++

    const juniorTrancheInfo = poolContract.getTranche(BigInt.fromI32(counter))

    const juniorId = `${address.toHexString()}-${juniorTrancheInfo.id.toString()}`
    let juniorTranche = JuniorTrancheInfo.load(juniorId)
    if (!juniorTranche) {
      juniorTranche = new JuniorTrancheInfo(juniorId)
    }
    juniorTranche.trancheId =  BigInt.fromI32(counter)
    juniorTranche.lockedUntil = juniorTrancheInfo.lockedUntil
    juniorTranche.tranchedPool = address.toHexString()
    juniorTranche.principalSharePrice = juniorTrancheInfo.principalSharePrice
    juniorTranche.interestSharePrice = juniorTrancheInfo.interestSharePrice
    juniorTranche.principalDeposited = juniorTrancheInfo.principalDeposited
    juniorTranche.save()
    juniorTranches.push(juniorTranche)

    counter++
  }

  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  const configContract = GoldfinchConfigContract.bind(Address.fromString(GOLDFINCH_CONFIG_ADDRESS))

  tranchedPool.juniorFeePercent = poolContract.juniorFeePercent()
  tranchedPool.reserveFeePercent = BigInt.fromI32(100).div(configContract.getNumber(BigInt.fromI32(ReserveDenominatorIndex)))
  tranchedPool.estimatedSeniorPoolContribution = seniorPoolContract.estimateInvestment(address)
  tranchedPool.estimatedLeverageRatio = getEstimatedLeverageRatio(address, juniorTranches, seniorTranches)
  tranchedPool.estimatedTotalAssets = getEstimatedTotalAssets(address, juniorTranches, seniorTranches)
  tranchedPool.totalDeposited = getTotalDeposited(address, juniorTranches, seniorTranches)
  tranchedPool.isPaused = poolContract.paused()
  tranchedPool.save()
  return tranchedPool
}

export function updatePoolCreditLine(address: Address): void {
  const contract = TranchedPoolContract.bind(address)
  let tranchedPool = getOrInitTranchedPool(address)

  const creditLineAddress = contract.creditLine().toHexString()
  const creditLine = initOrUpdateCreditLine(Address.fromString(creditLineAddress))

  tranchedPool.creditLine = creditLine.id
  tranchedPool.save()
}

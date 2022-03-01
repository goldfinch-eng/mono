import {Address, BigInt} from "@graphprotocol/graph-ts"
import {
  TranchedPool,
  JuniorTrancheInfo,
  SeniorTrancheInfo,
  PoolBacker,
  TranchedPoolDeposit,
} from "../../generated/schema"
import {DepositMade} from "../../generated/templates/TranchedPool/TranchedPool"
import {SeniorPool as SeniorPoolContract} from "../../generated/templates/GoldfinchFactory/SeniorPool"
import {TranchedPool as TranchedPoolContract} from "../../generated/templates/GoldfinchFactory/TranchedPool"
import {GoldfinchConfig as GoldfinchConfigContract} from "../../generated/templates/GoldfinchFactory/GoldfinchConfig"
import {GOLDFINCH_CONFIG_ADDRESS, ReserveDenominatorConfigIndex, SENIOR_POOL_ADDRESS} from "../constants"
import {getOrInitUser} from "./user"
import {getOrInitCreditLine, initOrUpdateCreditLine} from "./credit_line"
import {getOrInitPoolBacker} from "./pool_backer"
import {getOrInitSeniorPoolStatus} from "./senior_pool"
import {
  getEstimatedLeverageRatio,
  getTotalDeposited,
  getEstimatedTotalAssets,
  isKnownTranchedPool,
  getTranchedPoolName,
  isV1StyleDeal,
} from "./helpers"

export function updatePoolCreditLine(address: Address): void {
  const contract = TranchedPoolContract.bind(address)
  let tranchedPool = getOrInitTranchedPool(address)

  const creditLineAddress = contract.creditLine().toHexString()
  const creditLine = initOrUpdateCreditLine(Address.fromString(creditLineAddress))

  tranchedPool.creditLine = creditLine.id
  tranchedPool.save()
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

  let backer = getOrInitPoolBacker(event.address, userAddress)
  let addresses = tranchedPool.backers
  addresses.push(backer.id)
  tranchedPool.backers = addresses
  tranchedPool.save()

  updatePoolCreditLine(event.address)
}

export function getOrInitTranchedPool(poolAddress: Address): TranchedPool {
  let tranchedPool = TranchedPool.load(poolAddress.toHexString())
  if (!tranchedPool) {
    tranchedPool = initOrUpdateTranchedPool(poolAddress)
  }
  return tranchedPool
}

export function initOrUpdateTranchedPool(address: Address): TranchedPool {
  let tranchedPool = TranchedPool.load(address.toHexString())
  let isCreating = !tranchedPool
  if (!tranchedPool) {
    tranchedPool = new TranchedPool(address.toHexString())
  }

  let numSlices = BigInt.fromI32(1) // TODO update here to support version of tranched pool with multiples slices
  const poolContract = TranchedPoolContract.bind(address)
  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  const configContract = GoldfinchConfigContract.bind(Address.fromString(GOLDFINCH_CONFIG_ADDRESS))

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
    seniorTranche.trancheId = BigInt.fromI32(counter)
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
    juniorTranche.trancheId = BigInt.fromI32(counter)
    juniorTranche.lockedUntil = juniorTrancheInfo.lockedUntil
    juniorTranche.tranchedPool = address.toHexString()
    juniorTranche.principalSharePrice = juniorTrancheInfo.principalSharePrice
    juniorTranche.interestSharePrice = juniorTrancheInfo.interestSharePrice
    juniorTranche.principalDeposited = juniorTrancheInfo.principalDeposited
    juniorTranche.save()
    juniorTranches.push(juniorTranche)

    counter++
  }

  tranchedPool.juniorFeePercent = poolContract.juniorFeePercent()
  tranchedPool.reserveFeePercent = BigInt.fromI32(100).div(
    configContract.getNumber(BigInt.fromI32(ReserveDenominatorConfigIndex))
  )
  tranchedPool.estimatedSeniorPoolContribution = seniorPoolContract.estimateInvestment(address)
  tranchedPool.estimatedLeverageRatio = getEstimatedLeverageRatio(address, juniorTranches, seniorTranches)
  tranchedPool.estimatedTotalAssets = getEstimatedTotalAssets(address, juniorTranches, seniorTranches)
  tranchedPool.totalDeposited = getTotalDeposited(address, juniorTranches, seniorTranches)
  tranchedPool.isPaused = poolContract.paused()
  tranchedPool.isValid = isKnownTranchedPool(address)
  tranchedPool.name = getTranchedPoolName(address)
  tranchedPool.isV1StyleDeal = isV1StyleDeal(address)

  if (isCreating) {
    const creditLineAddress = poolContract.creditLine().toHexString()
    const creditLine = getOrInitCreditLine(Address.fromString(creditLineAddress))
    tranchedPool.creditLine = creditLine.id
    tranchedPool.backers = []
    tranchedPool.tokens = []
  }

  tranchedPool.save()

  if (isCreating && tranchedPool.isValid) {
    const seniorPoolStatus = getOrInitSeniorPoolStatus()
    const tpl = seniorPoolStatus.tranchedPools
    tpl.push(tranchedPool.id)
    seniorPoolStatus.tranchedPools = tpl
    seniorPoolStatus.save()
  }

  return tranchedPool
}

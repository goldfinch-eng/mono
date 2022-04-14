import {Address, BigInt, log} from "@graphprotocol/graph-ts"
import {
  TranchedPool,
  JuniorTrancheInfo,
  SeniorTrancheInfo,
  PoolBacker,
  TranchedPoolDeposit,
  TranchedPoolBorrowerTransaction,
} from "../../generated/schema"
import {DepositMade, DrawdownMade, PaymentApplied} from "../../generated/templates/TranchedPool/TranchedPool"
import {SeniorPool as SeniorPoolContract} from "../../generated/templates/GoldfinchFactory/SeniorPool"
import {TranchedPool as TranchedPoolContract} from "../../generated/templates/GoldfinchFactory/TranchedPool"
import {GoldfinchConfig as GoldfinchConfigContract} from "../../generated/templates/GoldfinchFactory/GoldfinchConfig"
import {CONFIG_KEYS_NUMBERS, GOLDFINCH_CONFIG_ADDRESS, SENIOR_POOL_ADDRESS} from "../constants"
import {getOrInitUser} from "./user"
import {getOrInitCreditLine, initOrUpdateCreditLine} from "./credit_line"
import {getOrInitPoolBacker} from "./pool_backer"
import {getEstimatedLeverageRatio, getTotalDeposited, getEstimatedTotalAssets} from "./helpers"
import {isAfterV2_2, VERSION_BEFORE_V2_2, VERSION_V2_2} from "../utils"

export function updatePoolCreditLine(address: Address, timestamp: BigInt): void {
  const contract = TranchedPoolContract.bind(address)
  let tranchedPool = getOrInitTranchedPool(address, timestamp)

  const creditLineAddress = contract.creditLine().toHexString()
  const creditLine = initOrUpdateCreditLine(Address.fromString(creditLineAddress), timestamp)

  tranchedPool.creditLine = creditLine.id
  tranchedPool.save()
}

export function handleDeposit(event: DepositMade): void {
  const userAddress = event.params.owner
  const user = getOrInitUser(userAddress)

  let tranchedPool = getOrInitTranchedPool(event.address, event.block.timestamp)
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

  updatePoolCreditLine(event.address, event.block.timestamp)
}

export function getOrInitTranchedPool(poolAddress: Address, timestamp: BigInt): TranchedPool {
  let tranchedPool = TranchedPool.load(poolAddress.toHexString())
  if (!tranchedPool) {
    tranchedPool = initOrUpdateTranchedPool(poolAddress, timestamp)
  }
  return tranchedPool
}

export function initOrUpdateTranchedPool(address: Address, timestamp: BigInt): TranchedPool {
  let tranchedPool = TranchedPool.load(address.toHexString())
  let isCreating = !tranchedPool
  if (!tranchedPool) {
    tranchedPool = new TranchedPool(address.toHexString())
  }

  const poolContract = TranchedPoolContract.bind(address)
  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  const configContract = GoldfinchConfigContract.bind(Address.fromString(GOLDFINCH_CONFIG_ADDRESS))

  let version: string = VERSION_BEFORE_V2_2
  let numSlices = BigInt.fromI32(1)
  let totalDeployed: BigInt = BigInt.fromI32(0)
  let fundableAt: BigInt = BigInt.fromI32(0)
  if (timestamp && isAfterV2_2(timestamp)) {
    const callResult = poolContract.try_numSlices()
    if (callResult.reverted) {
      log.warning("numSlices reverted for pool {}", [address.toHexString()])
    } else {
      // Assuming that a pool is a v2_2 pool if requests work
      numSlices = callResult.value
      version = VERSION_V2_2
    }
    const callTotalDeployed = poolContract.try_totalDeployed()
    if (callTotalDeployed.reverted) {
      log.warning("totalDeployed reverted for pool {}", [address.toHexString()])
    } else {
      totalDeployed = callTotalDeployed.value
      // Assuming that a pool is a v2_2 pool if requests work
      version = VERSION_V2_2
    }
    const callFundableAt = poolContract.try_fundableAt()
    if (callFundableAt.reverted) {
      log.warning("fundableAt reverted for pool {}", [address.toHexString()])
    } else {
      fundableAt = callFundableAt.value
      // Assuming that a pool is a v2_2 pool if requests work
      version = VERSION_V2_2
    }
  }

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
    configContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.ReserveDenominator))
  )
  tranchedPool.estimatedSeniorPoolContribution = seniorPoolContract.estimateInvestment(address)
  tranchedPool.estimatedLeverageRatio = getEstimatedLeverageRatio(address, juniorTranches, seniorTranches)
  tranchedPool.estimatedTotalAssets = getEstimatedTotalAssets(address, juniorTranches, seniorTranches)
  tranchedPool.totalDeposited = getTotalDeposited(address, juniorTranches, seniorTranches)
  tranchedPool.isPaused = poolContract.paused()
  tranchedPool.version = version
  tranchedPool.totalDeployed = totalDeployed
  tranchedPool.fundableAt = fundableAt

  if (isCreating) {
    const creditLineAddress = poolContract.creditLine().toHexString()
    const creditLine = getOrInitCreditLine(Address.fromString(creditLineAddress), timestamp)
    tranchedPool.creditLine = creditLine.id
    tranchedPool.backers = []
    tranchedPool.tokens = []
  }

  tranchedPool.save()
  return tranchedPool
}

export function handleDrawdownMade(event: DrawdownMade): void {
  const borrowerTransaction = new TranchedPoolBorrowerTransaction(event.transaction.hash.toHexString())
  const tranchedPool = getOrInitTranchedPool(event.address, event.block.timestamp)
  borrowerTransaction.tranchedPool = tranchedPool.id
  borrowerTransaction.amount = event.params.amount
  borrowerTransaction.timestamp = event.block.timestamp
  borrowerTransaction.blockNumber = event.block.number
  borrowerTransaction.type = "DRAWDOWN_MADE"
  borrowerTransaction.save()
}

export function handlePaymentApplied(event: PaymentApplied): void {
  const borrowerTransaction = new TranchedPoolBorrowerTransaction(event.transaction.hash.toHexString())
  const tranchedPool = getOrInitTranchedPool(event.address, event.block.timestamp)
  borrowerTransaction.tranchedPool = tranchedPool.id
  const interestAmount = event.params.interestAmount
  const totalPrincipalAmount = event.params.principalAmount.plus(event.params.remainingAmount)
  borrowerTransaction.amount = interestAmount.plus(totalPrincipalAmount)
  borrowerTransaction.timestamp = event.block.timestamp
  borrowerTransaction.blockNumber = event.block.number
  borrowerTransaction.type = "PAYMENT_APPLIED"
  borrowerTransaction.save()
}

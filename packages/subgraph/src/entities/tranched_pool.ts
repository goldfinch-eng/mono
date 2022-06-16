import {Address, BigDecimal, BigInt, log} from "@graphprotocol/graph-ts"
import {
  TranchedPool,
  JuniorTrancheInfo,
  SeniorTrancheInfo,
  TranchedPoolDeposit,
  CreditLine,
} from "../../generated/schema"
import {DepositMade} from "../../generated/templates/TranchedPool/TranchedPool"
import {TranchedPool as TranchedPoolContract} from "../../generated/templates/GoldfinchFactory/TranchedPool"
import {SECONDS_PER_DAY, GFI_DECIMALS, USDC_DECIMALS, SECONDS_PER_YEAR} from "../constants"
import {getOrInitUser} from "./user"
import {getOrInitCreditLine, initOrUpdateCreditLine} from "./credit_line"
import {getOrInitPoolBacker} from "./pool_backer"
import {getOrInitSeniorPoolStatus} from "./senior_pool"
import {
  getLeverageRatio,
  getTotalDeposited,
  getEstimatedTotalAssets,
  isV1StyleDeal,
  estimateJuniorAPY,
  getReserveFeePercent,
  getEstimatedSeniorPoolInvestment,
  getJuniorDeposited,
} from "./helpers"
import {bigDecimalToBigInt, bigIntMin, ceil, isAfterV2_2, VERSION_BEFORE_V2_2, VERSION_V2_2} from "../utils"
import {getBackerRewards} from "./backer_rewards"

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
  const juniorTrancheInfo = JuniorTrancheInfo.load(`${event.address.toHexString()}-${event.params.tranche.toString()}`)
  if (juniorTrancheInfo) {
    juniorTrancheInfo.principalDeposited = juniorTrancheInfo.principalDeposited.plus(event.params.amount)
    juniorTrancheInfo.save()
  }

  let backer = getOrInitPoolBacker(event.address, userAddress)
  if (!tranchedPool.backers.includes(backer.id)) {
    const addresses = tranchedPool.backers
    addresses.push(backer.id)
    tranchedPool.backers = addresses
    tranchedPool.numBackers = addresses.length
  }

  tranchedPool.estimatedTotalAssets = tranchedPool.estimatedTotalAssets.plus(event.params.amount)
  tranchedPool.juniorDeposited = tranchedPool.juniorDeposited.plus(event.params.amount)
  const creditLine = CreditLine.load(tranchedPool.creditLine)
  if (!creditLine) {
    throw new Error(`Missing credit line for tranched pool ${tranchedPool.id} while handling deposit`)
  }
  const limit = !creditLine.limit.isZero() ? creditLine.limit : creditLine.maxLimit
  tranchedPool.remainingCapacity = limit.minus(tranchedPool.estimatedTotalAssets)
  tranchedPool.remainingJuniorCapacity = tranchedPool.remainingJuniorCapacity.minus(event.params.amount)

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
  tranchedPool.reserveFeePercent = getReserveFeePercent(timestamp)
  tranchedPool.estimatedSeniorPoolContribution = getEstimatedSeniorPoolInvestment(address, version)
  tranchedPool.estimatedTotalAssets = getEstimatedTotalAssets(address, juniorTranches, seniorTranches, version)
  tranchedPool.totalDeposited = getTotalDeposited(address, juniorTranches, seniorTranches)
  tranchedPool.juniorDeposited = getJuniorDeposited(juniorTranches)
  tranchedPool.isPaused = poolContract.paused()
  tranchedPool.isV1StyleDeal = isV1StyleDeal(address)
  tranchedPool.version = version
  tranchedPool.totalDeployed = totalDeployed
  tranchedPool.createdAt = poolContract.createdAt()
  tranchedPool.fundableAt = fundableAt.isZero() ? tranchedPool.createdAt : fundableAt

  const creditLineAddress = poolContract.creditLine().toHexString()
  const creditLine = getOrInitCreditLine(Address.fromString(creditLineAddress), timestamp)
  tranchedPool.creditLine = creditLine.id
  const limit = !creditLine.limit.isZero() ? creditLine.limit : creditLine.maxLimit
  tranchedPool.remainingCapacity = limit.minus(tranchedPool.estimatedTotalAssets)
  // This can happen in weird cases where the senior pool investment causes a pool to overfill
  if (tranchedPool.remainingCapacity.lt(BigInt.zero())) {
    tranchedPool.remainingCapacity = BigInt.zero()
  }
  if (isCreating) {
    tranchedPool.backers = []
    tranchedPool.tokens = []
    tranchedPool.estimatedLeverageRatio = getLeverageRatio(timestamp)
  }
  tranchedPool.remainingJuniorCapacity = limit
    .minus(tranchedPool.juniorDeposited.times(tranchedPool.estimatedLeverageRatio.plus(BigInt.fromI32(1))))
    .div(tranchedPool.estimatedLeverageRatio.plus(BigInt.fromI32(1)))
  if (tranchedPool.remainingJuniorCapacity.lt(BigInt.zero())) {
    tranchedPool.remainingJuniorCapacity = BigInt.zero()
  }

  const getAllowedUIDTypes_callResult = poolContract.try_getAllowedUIDTypes()
  if (!getAllowedUIDTypes_callResult.reverted) {
    const allowedUidInts = getAllowedUIDTypes_callResult.value
    const allowedUidStrings: string[] = []
    for (let i = 0; i < allowedUidInts.length; i++) {
      const uidType = allowedUidInts[i]
      if (uidType.equals(BigInt.fromI32(0))) {
        allowedUidStrings.push("NON_US_INDIVIDUAL")
      } else if (uidType.equals(BigInt.fromI32(1))) {
        allowedUidStrings.push("US_ACCREDITED_INDIVIDUAL")
      } else if (uidType.equals(BigInt.fromI32(2))) {
        allowedUidStrings.push("US_NON_ACCREDITED_INDIVIDUAL")
      } else if (uidType.equals(BigInt.fromI32(3))) {
        allowedUidStrings.push("US_ENTITY")
      } else if (uidType.equals(BigInt.fromI32(4))) {
        allowedUidStrings.push("NON_US_ENTITY")
      }
    }
    tranchedPool.allowedUidTypes = allowedUidStrings
  } else {
    // by default, assume everything except US non-accredited individual is allowed
    tranchedPool.allowedUidTypes = ["NON_US_INDIVIDUAL", "US_ACCREDITED_INDIVIDUAL", "US_ENTITY", "NON_US_ENTITY"]
  }

  tranchedPool.estimatedJuniorApy = estimateJuniorAPY(tranchedPool)
  tranchedPool.totalAmountOwed = calculateTotalAmountOwed(creditLine)
  tranchedPool.save()

  if (isCreating) {
    const seniorPoolStatus = getOrInitSeniorPoolStatus()
    const tpl = seniorPoolStatus.tranchedPools
    tpl.push(tranchedPool.id)
    seniorPoolStatus.tranchedPools = tpl
    seniorPoolStatus.save()
  }
  calculateApyFromGfiForAllPools(timestamp)

  return tranchedPool
}

class Repayment {
  tranchedPoolAddress: string
  timestamp: BigInt
  interestAmount: BigInt
  constructor(tranchedPoolAddress: string, timestamp: BigInt, interestAmount: BigInt) {
    this.tranchedPoolAddress = tranchedPoolAddress
    this.timestamp = timestamp
    this.interestAmount = interestAmount
  }

  toString(): string {
    return `{ tranchedPoolAddress: ${
      this.tranchedPoolAddress
    }, timestamp: ${this.timestamp.toString()}, interestAmount: $${this.interestAmount.toString()} }`
  }
}

class GfiRewardOnInterest {
  tranchedPoolAddress: string
  timestamp: BigInt
  gfiAmount: BigDecimal
  constructor(tranchedPoolAddress: string, timestamp: BigInt, gfiAmount: BigDecimal) {
    this.tranchedPoolAddress = tranchedPoolAddress
    this.timestamp = timestamp
    this.gfiAmount = gfiAmount
  }
  toString(): string {
    return `{ tranchedPoolAddress: ${
      this.tranchedPoolAddress
    }, timestamp: ${this.timestamp.toString()}, gfiAmount: ${this.gfiAmount.toString()}}`
  }
}

export function calculateApyFromGfiForAllPools(now: BigInt): void {
  const backerRewards = getBackerRewards()
  // Bail out early if the backer rewards parameters aren't populated yet
  if (backerRewards.totalRewards == BigInt.zero() || backerRewards.maxInterestDollarsEligible == BigInt.zero()) {
    return
  }
  const seniorPoolStatus = getOrInitSeniorPoolStatus()
  const tranchedPoolList = seniorPoolStatus.tranchedPools
  let repaymentSchedules: Repayment[] = []
  for (let i = 0; i < tranchedPoolList.length; i++) {
    const tranchedPool = TranchedPool.load(tranchedPoolList[i])
    if (!tranchedPool) {
      continue
    }
    const creditLine = CreditLine.load(tranchedPool.creditLine)
    if (!creditLine || !creditLine.isEligibleForRewards) {
      continue
    }
    const schedule = getApproximateRepaymentSchedule(tranchedPool, now)
    repaymentSchedules = repaymentSchedules.concat(schedule)
  }
  repaymentSchedules.sort(repaymentComparator)

  const rewardsSchedules = estimateRewards(
    repaymentSchedules,
    backerRewards.totalRewards,
    backerRewards.maxInterestDollarsEligible
  )
  const summedRewardsByTranchedPool = new Map<String, BigDecimal>()
  for (let i = 0; i < rewardsSchedules.length; i++) {
    const reward = rewardsSchedules[i]
    const tranchedPoolAddress = reward.tranchedPoolAddress
    if (summedRewardsByTranchedPool.has(tranchedPoolAddress)) {
      const currentSum = summedRewardsByTranchedPool.get(tranchedPoolAddress)
      summedRewardsByTranchedPool.set(tranchedPoolAddress, currentSum.plus(reward.gfiAmount))
    } else {
      summedRewardsByTranchedPool.set(tranchedPoolAddress, reward.gfiAmount)
    }
  }
  const gfiPerPrincipalDollar = calculateAnnualizedGfiRewardsPerPrincipalDollar(summedRewardsByTranchedPool)
  for (let i = 0; i < gfiPerPrincipalDollar.keys().length; i++) {
    const tranchedPoolAddress = gfiPerPrincipalDollar.keys()[i]
    const tranchedPool = TranchedPool.load(tranchedPoolAddress as string)
    if (!tranchedPool) {
      continue
    }
    tranchedPool.estimatedJuniorApyFromGfiRaw = gfiPerPrincipalDollar
      .get(tranchedPoolAddress)
      .div(GFI_DECIMALS.toBigDecimal())
    tranchedPool.save()
  }
}

// TODO tiebreaking logic
function repaymentComparator(a: Repayment, b: Repayment): i32 {
  const timeDiff = a.timestamp.minus(b.timestamp)
  return timeDiff.toI32()
}

function getApproximateRepaymentSchedule(tranchedPool: TranchedPool, now: BigInt): Repayment[] {
  const creditLine = CreditLine.load(tranchedPool.creditLine)
  if (!creditLine) {
    return []
  }

  // When should we say that interest will start being earned on this additional balance?
  // We can't be sure exactly. There's currently no notion of a deadline for funding
  // the pool, nor hard start time of the borrowing. We'll make a reasonable supposition:
  // if the creditLine has a start time defined, use that. If it doesn't, assume the interest starts
  // 7 days after the pool became fundable (and if that value isn't populated, use the pool's creation date)
  let startTime: BigInt
  let endTime: BigInt
  if (creditLine.termStartTime != BigInt.zero() && creditLine.termEndTime != BigInt.zero()) {
    startTime = creditLine.termStartTime
    endTime = creditLine.termEndTime
  } else {
    startTime = tranchedPool.fundableAt.plus(SECONDS_PER_DAY.times(BigInt.fromString("7")))
    endTime = startTime.plus(SECONDS_PER_DAY.times(creditLine.termInDays))
  }

  const secondsPerPaymentPeriod = creditLine.paymentPeriodInDays.times(SECONDS_PER_DAY)
  const expectedAnnualInterest = creditLine.maxLimit.toBigDecimal().times(creditLine.interestAprDecimal)
  const repayments: Repayment[] = []
  let periodStartTime = startTime
  while (periodStartTime < endTime) {
    const periodEndTime = bigIntMin(periodStartTime.plus(secondsPerPaymentPeriod), endTime)
    const periodDuration = periodEndTime.minus(periodStartTime)
    const interestAmount = expectedAnnualInterest
      .times(periodDuration.toBigDecimal())
      .div(SECONDS_PER_YEAR.toBigDecimal())
    repayments.push(new Repayment(tranchedPool.id, periodEndTime, bigDecimalToBigInt(interestAmount)))
    periodStartTime = periodEndTime
  }
  return repayments
}

function estimateRewards(
  repaymentSchedules: Repayment[],
  totalGfiAvailableForBackerRewards: BigInt, // TODO instead of relying on BackerRewards.totalRewards(), manually calculate that amount using GFI total suppy and totalRewardPercentOfTotalGFI
  maxInterestDollarsEligible: BigInt
): GfiRewardOnInterest[] {
  const rewards: GfiRewardOnInterest[] = []
  let oldTotalInterest = BigInt.zero()
  for (let i = 0; i < repaymentSchedules.length; i++) {
    const repayment = repaymentSchedules[i]
    // Need to use big numbers to get decent accuracy during integer sqrt
    let newTotalInterest = oldTotalInterest.plus(repayment.interestAmount.times(GFI_DECIMALS).div(USDC_DECIMALS))
    if (newTotalInterest.gt(maxInterestDollarsEligible)) {
      newTotalInterest = maxInterestDollarsEligible
    }
    const sqrtDiff = newTotalInterest.sqrt().minus(oldTotalInterest.sqrt())
    const gfiAmount = sqrtDiff
      .times(totalGfiAvailableForBackerRewards)
      .divDecimal(maxInterestDollarsEligible.sqrt().toBigDecimal())
    rewards.push(new GfiRewardOnInterest(repayment.tranchedPoolAddress, repayment.timestamp, gfiAmount))
    oldTotalInterest = newTotalInterest
  }

  return rewards
}

// ! The estimate done here is very crude. It's not as accurate as the code that lives at `ethereum/backerRewards` in the old Goldfinch client
function calculateAnnualizedGfiRewardsPerPrincipalDollar(
  summedRewardsByTranchedPool: Map<String, BigDecimal>
): Map<String, BigDecimal> {
  const rewardsPerPrincipalDollar = new Map<String, BigDecimal>()
  for (let i = 0; i < summedRewardsByTranchedPool.keys().length; i++) {
    const tranchedPoolAddress = summedRewardsByTranchedPool.keys()[i]
    const tranchedPool = TranchedPool.load(tranchedPoolAddress as string)
    if (!tranchedPool) {
      throw new Error("Unable to load tranchedPool from summedRewardsByTranchedPool")
    }
    const creditLine = CreditLine.load(tranchedPool.creditLine)
    if (!creditLine) {
      throw new Error("Unable to load creditLine from summedRewardsByTranchedPool")
    }
    const juniorPrincipalDollars = creditLine.maxLimit
      .divDecimal(tranchedPool.estimatedLeverageRatio.plus(BigInt.fromI32(1)).toBigDecimal())
      .div(USDC_DECIMALS.toBigDecimal())
    const reward = summedRewardsByTranchedPool.get(tranchedPoolAddress)
    const perPrincipalDollar = reward.div(juniorPrincipalDollars)

    const numYears = creditLine.termInDays.divDecimal(BigDecimal.fromString("365"))
    const annualizedPerPrincipalDollar = perPrincipalDollar.div(numYears)
    rewardsPerPrincipalDollar.set(tranchedPoolAddress, annualizedPerPrincipalDollar)
  }
  return rewardsPerPrincipalDollar
}

export function updateTranchedPoolLeverageRatio(tranchedPoolAddress: Address, timestamp: BigInt): void {
  const tranchedPool = TranchedPool.load(tranchedPoolAddress.toHexString())
  if (!tranchedPool) {
    return
  }
  tranchedPool.estimatedLeverageRatio = getLeverageRatio(timestamp)
  tranchedPool.save()
}

function calculateTotalAmountOwed(creditLine: CreditLine): BigInt {
  const principal = creditLine.limit.toBigDecimal()
  const interestRate = creditLine.interestAprDecimal
  const numPayments = ceil(creditLine.termInDays.divDecimal(creditLine.paymentPeriodInDays.toBigDecimal())).toI32()
  const paymentsPerYear = BigInt.fromI32(365).divDecimal(creditLine.paymentPeriodInDays.toBigDecimal())
  let power = BigDecimal.fromString("1")
  for (let i = 0; i < numPayments; i++) {
    power = power.times(BigDecimal.fromString("1").plus(interestRate.div(paymentsPerYear)))
  }
  return ceil(principal.times(power))
}

import {Address, BigDecimal, BigInt, log} from "@graphprotocol/graph-ts"
import {
  TranchedPool,
  JuniorTrancheInfo,
  SeniorTrancheInfo,
  TranchedPoolDeposit,
  CreditLine,
} from "../../generated/schema"
import {DepositMade} from "../../generated/templates/TranchedPool/TranchedPool"
import {SeniorPool as SeniorPoolContract} from "../../generated/templates/GoldfinchFactory/SeniorPool"
import {TranchedPool as TranchedPoolContract} from "../../generated/templates/GoldfinchFactory/TranchedPool"
import {GoldfinchConfig as GoldfinchConfigContract} from "../../generated/templates/GoldfinchFactory/GoldfinchConfig"
import {
  CONFIG_KEYS_NUMBERS,
  GOLDFINCH_CONFIG_ADDRESS,
  SENIOR_POOL_ADDRESS,
  SECONDS_PER_YEAR,
  SECONDS_PER_DAY,
} from "../constants"
import {getOrInitUser} from "./user"
import {getOrInitCreditLine, initOrUpdateCreditLine} from "./credit_line"
import {getOrInitPoolBacker} from "./pool_backer"
import {getOrInitSeniorPoolStatus} from "./senior_pool"
import {
  getEstimatedLeverageRatio,
  getTotalDeposited,
  getEstimatedTotalAssets,
  isV1StyleDeal,
  estimateJuniorAPY,
} from "./helpers"
import {isAfterV2_2, VERSION_BEFORE_V2_2, VERSION_V2_2} from "../utils"

// AssemblyScript doesn't have enums in the language spec yet, so we'll use a class to fake it. Must match the PoolState enum in schema.graphql
class PoolState {
  static OPEN: string = "OPEN"
  static JUNIOR_LOCKED: string = "JUNIOR_LOCKED"
  static SENIOR_LOCKED: string = "SENIOR_LOCKED"
  static WITHDRAWALS_UNLOCKED: string = "WITHDRAWALS_UNLOCKED"
}

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
  tranchedPool.seniorTranches = seniorTranches.map<string>((sti: SeniorTrancheInfo) => sti.id)
  tranchedPool.juniorTranches = juniorTranches.map<string>((jti: JuniorTrancheInfo) => jti.id)
  tranchedPool.poolState = getPoolState(tranchedPool, timestamp)

  tranchedPool.juniorFeePercent = poolContract.juniorFeePercent()
  tranchedPool.reserveFeePercent = BigInt.fromI32(100).div(
    configContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.ReserveDenominator))
  )
  tranchedPool.estimatedSeniorPoolContribution = seniorPoolContract.estimateInvestment(address)
  tranchedPool.estimatedLeverageRatio = getEstimatedLeverageRatio(address, juniorTranches, seniorTranches)
  tranchedPool.estimatedTotalAssets = getEstimatedTotalAssets(address, juniorTranches, seniorTranches)
  tranchedPool.totalDeposited = getTotalDeposited(address, juniorTranches, seniorTranches)
  tranchedPool.isPaused = poolContract.paused()
  tranchedPool.isV1StyleDeal = isV1StyleDeal(address)
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

  tranchedPool.estimatedJuniorApy = estimateJuniorAPY(address.toHexString())
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

function getPoolState(tranchedPool: TranchedPool, now: BigInt): string {
  const juniorTranches = tranchedPool.juniorTranches
  const seniorTranches = tranchedPool.seniorTranches
  const juniorTrancheInfo = JuniorTrancheInfo.load(juniorTranches[juniorTranches.length - 1])
  const seniorTrancheInfo = SeniorTrancheInfo.load(seniorTranches[seniorTranches.length - 1])
  if (!juniorTrancheInfo) {
    throw new Error("Missing junior tranche when determining pool state")
  }
  if (!seniorTrancheInfo) {
    throw new Error("Missing senior tranche when determining pool state")
  }
  if (now < seniorTrancheInfo.lockedUntil) {
    return PoolState.SENIOR_LOCKED
  } else if (juniorTrancheInfo.lockedUntil == BigInt.zero()) {
    return PoolState.OPEN
  } else if (now < juniorTrancheInfo.lockedUntil || seniorTrancheInfo.lockedUntil == BigInt.zero()) {
    return PoolState.JUNIOR_LOCKED
  }
  return PoolState.WITHDRAWALS_UNLOCKED
}

class Repayment {
  tranchedPoolAddress: String
  timestamp: BigInt
  interestAmount: BigDecimal
  toString(): string {
    return `{ tranchedPoolAddress: ${
      this.tranchedPoolAddress
    }, timestamp: ${this.timestamp.toString()}, interestAmount: $${this.interestAmount.toString()} }`
  }
}

class GfiRewardOnInterest {
  tranchedPoolAddress: String
  timestamp: BigInt
  gfiAmount: BigDecimal
  toString(): string {
    return `{ tranchedPoolAddress: ${
      this.tranchedPoolAddress
    }, timestamp: ${this.timestamp.toString()}, gfiAmount: ${this.gfiAmount.toString()}}`
  }
}

function calculateApyFromGfiForAllPools(now: BigInt): void {
  const seniorPoolStatus = getOrInitSeniorPoolStatus()
  const tranchedPoolList = seniorPoolStatus.tranchedPools
  log.info("tranchedPoolList: {}", [tranchedPoolList.toString()])
  let repaymentSchedules: Repayment[] = []
  for (let i = 0; i < tranchedPoolList.length; i++) {
    const tranchedPool = TranchedPool.load(tranchedPoolList[i])
    if (!tranchedPool) {
      continue
    }
    const schedule = getApproximateRepaymentSchedule(tranchedPool, now)
    repaymentSchedules = repaymentSchedules.concat(schedule)
  }
  repaymentSchedules.sort(repaymentComparator)
  log.info("repaymentSchedules: {}", [repaymentSchedules.toString()])
}

// TODO tiebreaking logic
// @ts-ignore
function repaymentComparator(a: Repayment, b: Repayment): i32 {
  const timeDiff = a.timestamp.minus(b.timestamp)
  return timeDiff.toI32()
}

function getApproximateRepaymentSchedule(tranchedPool: TranchedPool, now: BigInt): Repayment[] {
  const creditLine = CreditLine.load(tranchedPool.creditLine)
  if (!creditLine) {
    return []
  }

  let startTime: BigInt
  let endTime: BigInt
  if (creditLine.termStartTime != BigInt.zero() && creditLine.termEndTime != BigInt.zero()) {
    startTime = creditLine.termStartTime
    endTime = creditLine.termEndTime
  } else {
    startTime = now.plus(SECONDS_PER_DAY.times(BigInt.fromString("7")))
    endTime = startTime.plus(SECONDS_PER_DAY.times(creditLine.termInDays))
  }

  const secondsPerPaymentPeriod = creditLine.paymentPeriodInDays.times(SECONDS_PER_DAY)
  const numRepayments = endTime.minus(startTime).div(secondsPerPaymentPeriod)

  const expectedInterest = creditLine.maxLimit.toBigDecimal().times(creditLine.interestAprDecimal)

  const repayments: Repayment[] = []
  const interestAmount = expectedInterest.div(numRepayments.toBigDecimal())
  for (let i = 0; i < numRepayments.toI32(); i++) {
    const repaymentTimestamp = startTime.plus(secondsPerPaymentPeriod.times(BigInt.fromI32(i)))
    repayments.push({
      tranchedPoolAddress: tranchedPool.id,
      timestamp: repaymentTimestamp,
      interestAmount: interestAmount,
    })
  }
  return repayments
}

// function getOptimisticRepaymentSchedule(tranchedPool: TranchedPool, now: BigInt): BigDecimal[] {
//   const creditLine = CreditLine.load(tranchedPool.creditLine)
//   if (!creditLine) {
//     return []
//   }
//   const juniorTranche = JuniorTrancheInfo.load(tranchedPool.juniorTranches[tranchedPool.juniorTranches.length - 1])
//   if (!juniorTranche) {
//     return []
//   }
//   const seniorTranche = SeniorTrancheInfo.load(tranchedPool.seniorTranches[tranchedPool.seniorTranches.length - 1])
//   if (!seniorTranche) {
//     return []
//   }

//   // 1. How much interest do we expect to be repaid in the remaining term of the loan?
//   // The answer consists of two parts: (i) the expected interest on funds that have
//   // *already* been borrowed (i.e. the current balance of the pool); plus (ii) the
//   // interest on additional funds that we can reasonably expect (based on the pool's state)
//   // will be borrowed. How much additional funds will be borrowed? We can't know exactly; we'll
//   // optimistically assume (see below) the pool fills up and/or the borrower borrows as much as
//   // they can.
//   // TODO: In future, when we may have multiple pools open at the same time, we may want to
//   // revise this optimistic repayment schedule calculation so that we don't assume that
//   // *all* open pools will fill up. Such an assumption means that any open pool could significantly
//   // impact the estimated rewards of every other pool; but such estimates seem likely
//   // flawed, because in practice not every proposed pool is equally likely to fill up. One
//   // alternative way to do the calculation could be to assume the given pool for which we're
//   // estimating rewards will fill up, but NOT to make that assumption for all the other open pools.

//   // (i)
//   // Our approach to calculating this here follows `Accountant.calculateInterestAccruedOverPeriod()`.
//   let expectedRemainingInterestFromAlreadyBorrowed = BigDecimal.zero()
//   let lastRepaymentTimeAlreadyBorrowed: BigInt = BigInt.zero()
//   let nextRepaymentTimeAlreadyBorrowed: BigInt = BigInt.zero()
//   if (creditLine.termEndTime > BigInt.zero()) {
//     lastRepaymentTimeAlreadyBorrowed = creditLine.lastFullPaymentTime
//     nextRepaymentTimeAlreadyBorrowed = creditLine.nextDueTime

//     const lastAccrualTimestamp = creditLine.interestAccruedAsOf
//     const interestAccruingSecondsRemaining = creditLine.termEndTime.minus(lastAccrualTimestamp)
//     const totalInterestPerYear = creditLine.balance.toBigDecimal().times(creditLine.interestAprDecimal)
//     const interestToBeAccruedSinceLastAccrual = totalInterestPerYear
//       .times(interestAccruingSecondsRemaining.toBigDecimal())
//       .div(SECONDS_PER_YEAR.toBigDecimal())
//     expectedRemainingInterestFromAlreadyBorrowed = creditLine.interestOwed
//       .toBigDecimal()
//       .plus(interestToBeAccruedSinceLastAccrual)

//     tranchedPool.save()
//   }

//   // (ii)
//   let expectedRemainingInterestFromToBeBorrowed: BigDecimal = BigDecimal.zero()
//   const secondsPerPaymentPeriod = creditLine.paymentPeriodInDays.times(SECONDS_PER_DAY)
//   let lastRepaymentTimeToBeBorrowed: BigInt
//   let nextRepaymentTimeToBeBorrowed: BigInt
//   let finalRepaymentTime: BigInt
//   if (tranchedPool.poolState != PoolState.WITHDRAWALS_UNLOCKED) {
//     // Because the pool is not in the WithdrawalsUnlocked state, there is the prospect of additional
//     // capital being borrowed. (Actually, even in the WithdrawalsUnlocked state, the borrower could
//     // drawdown additional capital that remains available in the pool (up to the pool's limit), but
//     // for the purposes here, we'll assume that once we've reached the WithdrawalsUnlocked state, the
//     // borrower isn't going to do so, as they had ample time to do so before withdrawals unlocked.)
//     // So we want to make a best-guess about what this additional balance will be.
//     //
//     // If the pool is Open, we'll optimistically assume the pool gets filled to its max
//     // limit and the borrower borrows all of this. We'll do the same if the pool is JuniorLocked;
//     // in theory, it would be more accurate to use a best-estimate of the leverage ratio, and
//     // use that to optimistically calculate how much the senior pool is going to invest, and assume
//     // the borrower borrows all of this, but I don't think this added complexity passes the cost-benefit
//     // test, given that the leverage ratio would be an estimate and therefore uncertain. If the pool is
//     // SeniorLocked, we can use the pool's current limit (because that gets updated in locking the
//     // senior tranche) and assume the borrower borrows all of it.
//     let optimisticAdditionalBalance: BigInt
//     if (tranchedPool.poolState == PoolState.OPEN || tranchedPool.poolState == PoolState.JUNIOR_LOCKED) {
//       optimisticAdditionalBalance = creditLine.maxLimit.minus(tranchedPool.totalDeployed)
//     } else if (tranchedPool.poolState == PoolState.SENIOR_LOCKED) {
//       optimisticAdditionalBalance = creditLine.limit.minus(tranchedPool.totalDeployed)
//     }
//     // When should we say that interest will start being earned on this additional balance?
//     // We can't be sure exactly. There's currently no notion of a deadline for funding
//     // the pool, nor hard start time of the borrowing. We'll make a reasonable supposition: if the
//     // pool is Open, we'll say the borrowing starts one week after the later of the current time
//     // and the pool's `fundableAt` timestamp. If the pool is JuniorLocked or SeniorLocked, we'll also say
//     // the borrowing won't start later than the relevant locked-until time (which is consistent with
//     // our assumption that no additional funds will be borrowed once the WithdrawalsUnlocked state is reached).
//     let _optimisticInterestAccrualStart = max(tranchedPool.fundableAt, now).plus(
//       SECONDS_PER_DAY.times(BigInt.fromString("7"))
//     )
//     if (tranchedPool.poolState == PoolState.OPEN) {
//       // pass
//     } else if (tranchedPool.poolState == PoolState.JUNIOR_LOCKED) {
//       _optimisticInterestAccrualStart = min(juniorTranche.lockedUntil, _optimisticInterestAccrualStart)
//     } else if (tranchedPool.poolState == PoolState.SENIOR_LOCKED) {
//       _optimisticInterestAccrualStart = min(seniorTranche.lockedUntil, _optimisticInterestAccrualStart)
//     }

//     let interestAccrualStart: BigInt, interestAccrualEnd: BigInt
//     if (creditLine.termEndTime > BigInt.zero()) {
//       interestAccrualStart = min(_optimisticInterestAccrualStart, creditLine.termEndTime)
//       interestAccrualEnd = creditLine.termEndTime

//       if (interestAccrualStart < creditLine.nextDueTime) {
//         lastRepaymentTimeToBeBorrowed = interestAccrualStart
//         nextRepaymentTimeToBeBorrowed = creditLine.nextDueTime
//       } else {
//         lastRepaymentTimeToBeBorrowed = creditLine.nextDueTime
//         nextRepaymentTimeToBeBorrowed = min(
//           lastRepaymentTimeToBeBorrowed.plus(secondsPerPaymentPeriod),
//           interestAccrualEnd
//         )
//       }

//       finalRepaymentTime = interestAccrualEnd
//     } else {
//       interestAccrualStart = _optimisticInterestAccrualStart
//       interestAccrualEnd = interestAccrualStart.plus(creditLine.termInDays.times(SECONDS_PER_DAY))

//       lastRepaymentTimeToBeBorrowed = interestAccrualStart
//       nextRepaymentTimeToBeBorrowed = interestAccrualStart.plus(secondsPerPaymentPeriod)
//       finalRepaymentTime = interestAccrualEnd
//     }

//     const interestAccruingSecondsRemaining = interestAccrualEnd.minus(interestAccrualStart)
//     const totalInterestPerYear = optimisticAdditionalBalance.toBigDecimal().times(creditLine.interestAprDecimal)
//     expectedRemainingInterestFromToBeBorrowed = totalInterestPerYear
//       .times(interestAccruingSecondsRemaining.toBigDecimal())
//       .div(SECONDS_PER_YEAR.toBigDecimal())
//   } else {
//     finalRepaymentTime = creditLine.termEndTime
//   }
//   const expectedRemainingInterest = expectedRemainingInterestFromAlreadyBorrowed.plus(
//     expectedRemainingInterestFromToBeBorrowed
//   )
//   tranchedPool.expectedRemainingInterest = expectedRemainingInterest
//   tranchedPool.save()

//   // 2. On what schedule do we expect the remaining repayments to occur?
//   // For (i) interest owed on the already-borrowed amount, we expect those payments to start at the
//   // credit line's `nextDueTime`, then one payment every `paymentPeriodInDays`, until the final payment
//   // at `termEndTime`. For (ii) interest on the to-be-borrowed amount, we expect those payments to
//   // start at the first next-due-time (aligned with (i)'s schedule) that occurs *after* the optimistic
//   // start of that borrowing, and then (again, aligned with (i)'s schedule), one payment every
//   // `paymentPeriodInDays`, until the final payment at `termEndTime`.

//   if (nextRepaymentTimeAlreadyBorrowed == BigInt.zero() || nextRepaymentTimeToBeBorrowed == BigInt.zero()) {
//     return []
//   }
//   const nextRepaymentTime = min(nextRepaymentTimeAlreadyBorrowed, nextRepaymentTimeToBeBorrowed)
//   const numRepaymentsRemaining = finalRepaymentTime
//     .minus(nextRepaymentTime)
//     .div(secondsPerPaymentPeriod)
//     .plus(
//       // This accounts for the payment due at `nextRepaymentTime`.
//       BigInt.fromString("1")
//     )
//     .toI32()

//   const scheduledRepayments: BigDecimal[] = []
//   let previousRepaymentTimeAlreadyBorrowed: BigInt = lastRepaymentTimeAlreadyBorrowed
//   let previousRepaymentTimeToBeBorrowed: BigInt = lastRepaymentTimeToBeBorrowed
//   let repaymentTime: BigInt = nextRepaymentTime
//   let workingRemainingInterest = expectedRemainingInterest
//   for (let i = 0, ii = numRepaymentsRemaining; i < ii; i++) {
//     let expectedRepaymentAlreadyBorrowed = BigDecimal.zero()
//     if (previousRepaymentTimeAlreadyBorrowed) {
//       expectedRepaymentAlreadyBorrowed = expectedRemainingInterestFromAlreadyBorrowed
//         .times(repaymentTime.minus(previousRepaymentTimeAlreadyBorrowed).toBigDecimal())
//         .div(finalRepaymentTime.minus(lastRepaymentTimeAlreadyBorrowed).toBigDecimal())

//       previousRepaymentTimeAlreadyBorrowed = repaymentTime
//     }

//     let expectedRepaymentToBeBorrowed = BigDecimal.zero()
//     if (previousRepaymentTimeToBeBorrowed) {
//       if (repaymentTime > previousRepaymentTimeToBeBorrowed) {
//         expectedRepaymentToBeBorrowed = expectedRemainingInterestFromToBeBorrowed
//           .times(repaymentTime.minus(previousRepaymentTimeToBeBorrowed).toBigDecimal())
//           .div(finalRepaymentTime.minus(lastRepaymentTimeToBeBorrowed).toBigDecimal())
//       }

//       previousRepaymentTimeToBeBorrowed = repaymentTime
//     }

//     const expectedRepayment = expectedRepaymentAlreadyBorrowed.plus(expectedRepaymentToBeBorrowed)

//     scheduledRepayments.push(expectedRepayment)

//     repaymentTime = min(repaymentTime.plus(secondsPerPaymentPeriod), finalRepaymentTime)
//     workingRemainingInterest = workingRemainingInterest.minus(expectedRepayment)
//   }

//   return scheduledRepayments
// }

import {Address, BigInt, BigDecimal, ethereum, store} from "@graphprotocol/graph-ts"
import {CallableLoan, ScheduledRepayment} from "../../../generated/schema"
import {CallableLoan as CallableLoanContract} from "../../../generated/templates/CallableLoan/CallableLoan"
import {Schedule as ScheduleContract} from "../../../generated/templates/CallableLoan/Schedule"

const INTEREST_DECIMALS = BigDecimal.fromString("1000000000000000000")

export function initCallableLoan(address: Address, block: ethereum.Block): CallableLoan {
  const id = address.toHexString()
  const callableLoan = new CallableLoan(id)
  const callableLoanContract = CallableLoanContract.bind(address)
  callableLoan.address = address
  callableLoan.fundingLimit = callableLoanContract.limit()
  callableLoan.principalAmount = BigInt.zero()
  callableLoan.initialInterestOwed = BigInt.zero() // TODO figure this out. There may be a view function for this
  callableLoan.usdcApy = callableLoanContract.interestApr().divDecimal(INTEREST_DECIMALS)
  callableLoan.rawGfiApy = BigDecimal.zero()
  callableLoan.totalDeposited = BigInt.zero()
  callableLoan.remainingCapacity = callableLoan.fundingLimit
  callableLoan.createdAt = block.timestamp.toI32()
  callableLoan.fundableAt = callableLoanContract.fundableAt().toI32()
  if (callableLoan.fundableAt == 0) {
    callableLoan.fundableAt = callableLoan.createdAt
  }
  callableLoan.allowedUidTypes = []
  const allowedUidTypes = callableLoanContract.getAllowedUIDTypes()
  for (let i = 0; i < allowedUidTypes.length; i++) {
    const uidType = allowedUidTypes[i]
    if (uidType.equals(BigInt.fromI32(0))) {
      callableLoan.allowedUidTypes = callableLoan.allowedUidTypes.concat(["NON_US_INDIVIDUAL"])
    } else if (uidType.equals(BigInt.fromI32(1))) {
      callableLoan.allowedUidTypes = callableLoan.allowedUidTypes.concat(["US_ACCREDITED_INDIVIDUAL"])
    } else if (uidType.equals(BigInt.fromI32(2))) {
      callableLoan.allowedUidTypes = callableLoan.allowedUidTypes.concat(["US_NON_ACCREDITED_INDIVIDUAL"])
    } else if (uidType.equals(BigInt.fromI32(3))) {
      callableLoan.allowedUidTypes = callableLoan.allowedUidTypes.concat(["US_ENTITY"])
    } else if (uidType.equals(BigInt.fromI32(4))) {
      callableLoan.allowedUidTypes = callableLoan.allowedUidTypes.concat(["NON_US_ENTITY"])
    }
  }
  callableLoan.backers = []
  callableLoan.numBackers = 0
  callableLoan.isPaused = false
  callableLoan.tokens = []

  callableLoan.balance = callableLoanContract.balance()
  callableLoan.paymentPeriodInDays = BigInt.fromI32(30) // TODO FIX THIS. `paymentPeriodInDays` should be removed from the Loan interface
  callableLoan.nextDueTime = callableLoanContract.nextDueTime()
  callableLoan.termEndTime = callableLoanContract.termEndTime()
  callableLoan.termStartTime = callableLoanContract.termStartTime()
  callableLoan.termInDays = 365 // TODO FIX THIS. Might be time to eliminate termInDays
  callableLoan.interestRate = callableLoan.usdcApy
  callableLoan.interestRateBigInt = callableLoanContract.interestApr()
  callableLoan.lateFeeRate = callableLoanContract.lateFeeApr().divDecimal(INTEREST_DECIMALS)

  callableLoan.repaymentSchedule = generateRepaymentScheduleForCallableLoan(callableLoan)

  return callableLoan
}

const twoWeeksSeconds = 86400 * 14
const secondsPerYear = BigInt.fromI32(31540000)

export function generateRepaymentScheduleForCallableLoan(callableLoan: CallableLoan): string[] {
  const repaymentIds: string[] = []
  const callableLoanContract = CallableLoanContract.bind(Address.fromBytes(callableLoan.address))
  const scheduleContract = ScheduleContract.bind(callableLoanContract.schedule())

  const isBeforeClose = callableLoanContract.termStartTime().isZero()

  if (isBeforeClose) {
    // Assume termStartTime will be 2 weeks after funding opens if it's not already known
    const startTime = scheduleContract.termStartTime(BigInt.fromI32(callableLoan.fundableAt + twoWeeksSeconds))
    const periodsInTerm = scheduleContract.periodsInTerm()
    const interestPerSecond = callableLoan.interestRateBigInt.div(secondsPerYear)

    let lastPeriodEndTime = startTime
    for (let period = 0; period < periodsInTerm.toI32(); period++) {
      const estimatedPaymentDate = scheduleContract.periodEndTime(startTime, BigInt.fromI32(period))
      const thisPeriodEndTime = scheduleContract.periodEndTime(startTime, BigInt.fromI32(period))
      const periodLengthSeconds = thisPeriodEndTime.minus(lastPeriodEndTime)
      lastPeriodEndTime = thisPeriodEndTime
      const interest = interestPerSecond
        .times(periodLengthSeconds)
        .times(callableLoan.fundingLimit)
        .div(BigInt.fromString("1000000000000000000"))
      const principal = period == periodsInTerm.toI32() - 1 ? callableLoan.fundingLimit : BigInt.zero()

      const scheduledRepayment = new ScheduledRepayment(`${callableLoan.id}-${period.toString()}`)
      scheduledRepayment.estimatedPaymentDate = estimatedPaymentDate.toI32()
      scheduledRepayment.paymentPeriod = period
      scheduledRepayment.interest = interest
      scheduledRepayment.principal = principal
      scheduledRepayment.save()
      repaymentIds.push(scheduledRepayment.id)
    }
  } else {
    const startTime = callableLoan.termStartTime
    const periodsInTerm = scheduleContract.periodsInTerm()
    let prevInterest = BigInt.zero()
    // TODO revisit this when we have access to the function for interestOwedAtSansLateFees
    for (let period = 0; period < periodsInTerm.toI32(); period++) {
      const estimatedPaymentDate = scheduleContract.periodEndTime(startTime, BigInt.fromI32(period))
      const interest = callableLoanContract.interestOwedAt(estimatedPaymentDate).minus(prevInterest)
      prevInterest = callableLoanContract.interestOwedAt(estimatedPaymentDate)
      const principal = callableLoanContract.principalOwedAt(estimatedPaymentDate)

      const scheduledRepayment = new ScheduledRepayment(`${callableLoan.id}-${period.toString()}`)
      scheduledRepayment.estimatedPaymentDate = estimatedPaymentDate.toI32()
      scheduledRepayment.paymentPeriod = period
      scheduledRepayment.interest = interest
      scheduledRepayment.principal = principal
      scheduledRepayment.save()
      repaymentIds.push(scheduledRepayment.id)
    }
  }

  return repaymentIds
}

/**
 * Deletes all of the ScheduledRepayment entities attached to a callable loan
 */
export function deleteCallableLoanRepaymentSchedule(callableLoan: CallableLoan): void {
  const repaymentIds = callableLoan.repaymentSchedule
  for (let i = 0; i < repaymentIds.length; i++) {
    store.remove("ScheduledRepayment", repaymentIds[i])
  }
  callableLoan.repaymentSchedule = []
}

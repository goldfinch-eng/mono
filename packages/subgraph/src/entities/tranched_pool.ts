import {Address, BigDecimal, BigInt, log, store} from "@graphprotocol/graph-ts"
import {
  TranchedPool,
  JuniorTrancheInfo,
  SeniorTrancheInfo,
  CreditLine,
  PoolToken,
  ScheduledRepayment,
} from "../../generated/schema"
import {TranchedPool as TranchedPoolContract, DepositMade} from "../../generated/templates/TranchedPool/TranchedPool"
import {GoldfinchConfig as GoldfinchConfigContract} from "../../generated/templates/TranchedPool/GoldfinchConfig"
import {CreditLine as CreditLineContract} from "../../generated/templates/TranchedPool/CreditLine"
import {Schedule as ScheduleContract} from "../../generated/templates/TranchedPool/Schedule"
import {GFI_DECIMALS, USDC_DECIMALS, CONFIG_KEYS_ADDRESSES, CONFIG_KEYS_NUMBERS, FIDU_DECIMALS} from "../constants"
import {getOrInitUser} from "./user"
import {initOrUpdateCreditLine} from "./credit_line"
import {
  getTotalDeposited,
  isV1StyleDeal,
  estimateJuniorAPY,
  getEstimatedSeniorPoolInvestment,
  getJuniorDeposited,
  getCreatedAtOverride,
} from "./helpers"
import {ceil, getAddressFromConfig, isAfterV2_2, VERSION_BEFORE_V2_2, VERSION_V2_2} from "../utils"
import {getBackerRewards} from "./backer_rewards"
import {BackerRewards as BackerRewardsContract} from "../../generated/BackerRewards/BackerRewards"
import {getListOfAllTranchedPoolAddresses} from "./protocol"

const cancelledPoolAddresses = ["0xd43a4f3041069c6178b99d55295b00d0db955bb5"]

export function updatePoolCreditLine(address: Address, timestamp: BigInt): void {
  const contract = TranchedPoolContract.bind(address)
  const creditLineAddress = contract.creditLine().toHexString()
  const creditLine = initOrUpdateCreditLine(Address.fromString(creditLineAddress), timestamp)
  const tranchedPool = getOrInitTranchedPool(address, timestamp)
  tranchedPool.creditLine = creditLine.id
  tranchedPool.save()
}

export function handleDeposit(event: DepositMade): void {
  const backer = getOrInitUser(event.params.owner)

  const tranchedPool = getOrInitTranchedPool(event.address, event.block.timestamp)
  const juniorTrancheInfo = JuniorTrancheInfo.load(`${event.address.toHexString()}-${event.params.tranche.toString()}`)
  if (juniorTrancheInfo) {
    juniorTrancheInfo.principalDeposited = juniorTrancheInfo.principalDeposited.plus(event.params.amount)
    juniorTrancheInfo.save()
  }

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
  const isCreating = !tranchedPool
  if (!tranchedPool) {
    tranchedPool = new TranchedPool(address.toHexString())
  }

  const poolContract = TranchedPoolContract.bind(address)
  const goldfinchConfigContract = GoldfinchConfigContract.bind(poolContract.config())
  const seniorPoolAddress = goldfinchConfigContract.getAddress(BigInt.fromI32(CONFIG_KEYS_ADDRESSES.SeniorPool))

  let version: string = VERSION_BEFORE_V2_2
  let numSlices = BigInt.fromI32(1)
  let fundableAt = 0
  if (timestamp && isAfterV2_2(timestamp)) {
    const callResult = poolContract.try_numSlices()
    if (callResult.reverted) {
      log.warning("numSlices reverted for pool {}", [address.toHexString()])
    } else {
      // Assuming that a pool is a v2_2 pool if requests work
      numSlices = callResult.value
      version = VERSION_V2_2
    }
    const callFundableAt = poolContract.try_fundableAt()
    if (callFundableAt.reverted) {
      log.warning("fundableAt reverted for pool {}", [address.toHexString()])
    } else {
      fundableAt = callFundableAt.value.toI32()
      // Assuming that a pool is a v2_2 pool if requests work
      version = VERSION_V2_2
    }
  }

  let counter = 1
  const juniorTranches: JuniorTrancheInfo[] = []
  const seniorTranches: SeniorTrancheInfo[] = []
  for (let i = 0; i < numSlices.toI32(); i++) {
    const seniorTrancheInfo = poolContract.getTranche(BigInt.fromI32(counter))
    const seniorId = `${address.toHexString()}-${seniorTrancheInfo.id.toString()}`
    let seniorTranche = SeniorTrancheInfo.load(seniorId)
    if (!seniorTranche) {
      seniorTranche = new SeniorTrancheInfo(seniorId)
    }
    seniorTranche.trancheId = BigInt.fromI32(counter)
    seniorTranche.lockedUntil = seniorTrancheInfo.lockedUntil
    seniorTranche.loan = address.toHexString()
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
    juniorTranche.loan = address.toHexString()
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
    goldfinchConfigContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.ReserveDenominator))
  )
  tranchedPool.estimatedSeniorPoolContribution = getEstimatedSeniorPoolInvestment(address, version, seniorPoolAddress)
  tranchedPool.totalDeposited = getTotalDeposited(address, juniorTranches, seniorTranches)
  tranchedPool.estimatedTotalAssets = tranchedPool.totalDeposited.plus(tranchedPool.estimatedSeniorPoolContribution)
  tranchedPool.juniorDeposited = getJuniorDeposited(juniorTranches)
  tranchedPool.isPaused = poolContract.paused()
  tranchedPool.drawdownsPaused = poolContract.drawdownsPaused()
  tranchedPool.isV1StyleDeal = isV1StyleDeal(address)
  tranchedPool.version = version
  const createdAtOverride = getCreatedAtOverride(address)
  tranchedPool.createdAt = createdAtOverride != 0 ? createdAtOverride : poolContract.createdAt().toI32()
  tranchedPool.fundableAt = fundableAt == 0 ? tranchedPool.createdAt : fundableAt
  tranchedPool.principalAmount = BigInt.zero()

  const creditLineAddress = poolContract.creditLine().toHexString()
  const creditLine = initOrUpdateCreditLine(Address.fromString(creditLineAddress), timestamp)
  tranchedPool.creditLine = creditLine.id
  tranchedPool.fundingLimit = creditLine.maxLimit
  tranchedPool.principalAmount = creditLine.limit
  tranchedPool.balance = creditLine.balance
  tranchedPool.nextDueTime = creditLine.nextDueTime
  tranchedPool.termEndTime = creditLine.termEndTime
  tranchedPool.termStartTime = creditLine.termStartTime
  tranchedPool.termInDays = creditLine.termInDays.toI32()
  tranchedPool.interestRate = creditLine.interestAprDecimal
  tranchedPool.interestRateBigInt = creditLine.interestApr
  tranchedPool.lateFeeRate = creditLine.lateFeeApr
  tranchedPool.interestAccruedAsOf = creditLine.interestAccruedAsOf
  tranchedPool.borrowerContract = creditLine.borrowerContract
  const limit = !creditLine.limit.isZero() ? creditLine.limit : creditLine.maxLimit
  tranchedPool.remainingCapacity = limit.minus(tranchedPool.estimatedTotalAssets)
  // This can happen in weird cases where the senior pool investment causes a pool to overfill
  if (tranchedPool.remainingCapacity.lt(BigInt.zero())) {
    tranchedPool.remainingCapacity = BigInt.zero()
  }
  if (isCreating) {
    tranchedPool.backers = []
    tranchedPool.tokens = []
    tranchedPool.numBackers = 0
    tranchedPool.principalAmountRepaid = BigInt.zero()
    tranchedPool.interestAmountRepaid = BigInt.zero()
    tranchedPool.actualSeniorPoolInvestment = null
    // V1 style deals do not have a leverage ratio because all capital came from the senior pool
    if (tranchedPool.isV1StyleDeal) {
      tranchedPool.estimatedLeverageRatio = null
    } else {
      tranchedPool.estimatedLeverageRatio = getLeverageRatioFromConfig(goldfinchConfigContract)
    }
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

  tranchedPool.initialInterestOwed = calculateInitialInterestOwed(creditLine)

  tranchedPool.address = address
  if (isCreating) {
    tranchedPool.repaymentSchedule = generateRepaymentScheduleForTranchedPool(tranchedPool)
  }
  tranchedPool.usdcApy = estimateJuniorAPY(tranchedPool)
  tranchedPool.rawGfiApy = BigDecimal.zero()
  tranchedPool.save()

  calculateApyFromGfiForAllPools()

  return tranchedPool
}

export function getLeverageRatioFromConfig(goldfinchConfigContract: GoldfinchConfigContract): BigDecimal {
  return goldfinchConfigContract
    .getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.LeverageRatio))
    .toBigDecimal()
    .div(FIDU_DECIMALS.toBigDecimal())
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

export function calculateApyFromGfiForAllPools(): void {
  const backerRewards = getBackerRewards()
  // Bail out early if the backer rewards parameters aren't populated yet
  if (backerRewards.totalRewards == BigInt.zero() || backerRewards.maxInterestDollarsEligible == BigInt.zero()) {
    return
  }
  // TODO this should exclude closed pools (like Cauris #3) but there's no on-chain indicator that can determine this.
  const tranchedPoolList = getListOfAllTranchedPoolAddresses()
  let repaymentSchedules: ScheduledRepayment[] = []
  for (let i = 0; i < tranchedPoolList.length; i++) {
    if (cancelledPoolAddresses.includes(tranchedPoolList[i])) {
      continue
    }
    // TODO there might be a scenario in the future where this needs to include callable loans
    const tranchedPool = TranchedPool.load(tranchedPoolList[i])
    if (!tranchedPool) {
      continue
    }
    const creditLine = CreditLine.load(tranchedPool.creditLine)
    if (!creditLine || !creditLine.isEligibleForRewards) {
      continue
    }
    const schedule = tranchedPool.repaymentSchedule.map<ScheduledRepayment>((id: string, index: i32, arr: string[]) =>
      assert(ScheduledRepayment.load(id))
    )
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
    tranchedPool.rawGfiApy = gfiPerPrincipalDollar.get(tranchedPoolAddress).div(GFI_DECIMALS.toBigDecimal())
    tranchedPool.save()
  }
}

// TODO tiebreaking logic
function repaymentComparator(a: ScheduledRepayment, b: ScheduledRepayment): i32 {
  const timeDiff = a.estimatedPaymentDate - b.estimatedPaymentDate
  return timeDiff
}

function estimateRewards(
  repaymentSchedules: ScheduledRepayment[],
  totalGfiAvailableForBackerRewards: BigInt, // TODO instead of relying on BackerRewards.totalRewards(), manually calculate that amount using GFI total suppy and totalRewardPercentOfTotalGFI
  maxInterestDollarsEligible: BigInt
): GfiRewardOnInterest[] {
  const rewards: GfiRewardOnInterest[] = []
  let oldTotalInterest = BigInt.zero()
  for (let i = 0; i < repaymentSchedules.length; i++) {
    const repayment = repaymentSchedules[i]
    // Need to use big numbers to get decent accuracy during integer sqrt
    let newTotalInterest = oldTotalInterest.plus(repayment.interest.times(GFI_DECIMALS).div(USDC_DECIMALS))
    if (newTotalInterest.gt(maxInterestDollarsEligible)) {
      newTotalInterest = maxInterestDollarsEligible
    }
    const sqrtDiff = newTotalInterest.sqrt().minus(oldTotalInterest.sqrt())
    const gfiAmount = sqrtDiff
      .times(totalGfiAvailableForBackerRewards)
      .divDecimal(maxInterestDollarsEligible.sqrt().toBigDecimal())
    rewards.push(new GfiRewardOnInterest(repayment.loan, BigInt.fromI32(repayment.estimatedPaymentDate), gfiAmount))
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

    let divisor: BigDecimal = BigDecimal.fromString("1")
    if (tranchedPool.estimatedLeverageRatio !== null) {
      divisor = tranchedPool.estimatedLeverageRatio!.plus(BigDecimal.fromString("1"))
    }
    const juniorPrincipalDollars = creditLine.maxLimit.divDecimal(divisor).div(USDC_DECIMALS.toBigDecimal())
    const reward = summedRewardsByTranchedPool.get(tranchedPoolAddress)
    const perPrincipalDollar = reward.div(juniorPrincipalDollars)

    const numYears = creditLine.termInDays.divDecimal(BigDecimal.fromString("365"))
    const annualizedPerPrincipalDollar = perPrincipalDollar.div(numYears)
    rewardsPerPrincipalDollar.set(tranchedPoolAddress, annualizedPerPrincipalDollar)
  }
  return rewardsPerPrincipalDollar
}

// Performs a simple (not compound) interest calculation on the creditLine, using the limit as the principal amount
function calculateInitialInterestOwed(creditLine: CreditLine): BigInt {
  const principal = creditLine.limit.toBigDecimal()
  const interestRatePerDay = creditLine.interestAprDecimal.div(BigDecimal.fromString("365"))
  const termInDays = creditLine.termInDays.toBigDecimal()
  const interestOwed = principal.times(interestRatePerDay.times(termInDays))
  return ceil(interestOwed)
}

// Goes through all of the tokens for this pool and updates their rewards claimable
export function updatePoolRewardsClaimable(
  tranchedPool: TranchedPool,
  tranchedPoolContract: TranchedPoolContract
): void {
  const backerRewardsContractAddress = getAddressFromConfig(tranchedPoolContract, CONFIG_KEYS_ADDRESSES.BackerRewards)
  if (backerRewardsContractAddress.equals(Address.zero())) {
    return
  }
  const backerRewardsContract = BackerRewardsContract.bind(backerRewardsContractAddress)
  const poolTokenIds = tranchedPool.tokens
  for (let i = 0; i < poolTokenIds.length; i++) {
    const poolToken = assert(PoolToken.load(poolTokenIds[i]))
    poolToken.rewardsClaimable = backerRewardsContract.poolTokenClaimableRewards(BigInt.fromString(poolToken.id))
    const stakingRewardsEarnedResult = backerRewardsContract.try_stakingRewardsEarnedSinceLastWithdraw(
      BigInt.fromString(poolToken.id)
    )
    if (!stakingRewardsEarnedResult.reverted) {
      poolToken.stakingRewardsClaimable = stakingRewardsEarnedResult.value
    }
    poolToken.save()
  }
}

export function updatePoolTokensRedeemable(tranchedPool: TranchedPool): void {
  const tranchedPoolContract = TranchedPoolContract.bind(Address.fromString(tranchedPool.id))
  const poolTokenIds = tranchedPool.tokens
  for (let i = 0; i < poolTokenIds.length; i++) {
    const poolToken = assert(PoolToken.load(poolTokenIds[i]))
    const availableToWithdrawResult = tranchedPoolContract.try_availableToWithdraw(BigInt.fromString(poolToken.id))
    if (!availableToWithdrawResult.reverted) {
      poolToken.interestRedeemable = availableToWithdrawResult.value.value0
      poolToken.principalRedeemable = availableToWithdrawResult.value.value1
    } else {
      log.warning("availableToWithdraw reverted for pool token {} on TranchedPool {}", [poolToken.id, tranchedPool.id])
    }
    poolToken.save()
  }
}

export function generateRepaymentScheduleForTranchedPool(tranchedPool: TranchedPool): string[] {
  const twoWeeksSeconds = 86400 * 14
  const secondsPerYear = BigInt.fromI32(31540000)
  const repaymentIds: string[] = []
  const tranchedPoolContract = TranchedPoolContract.bind(Address.fromBytes(tranchedPool.address))
  const creditLineContract = CreditLineContract.bind(tranchedPoolContract.creditLine())
  const cl_termStartTimeResult = creditLineContract.try_termStartTime()
  const isBeforeClose = !cl_termStartTimeResult.reverted && cl_termStartTimeResult.value.isZero()
  const isPostBpi = creditLineContract.try_paymentPeriodInDays().reverted

  if (isPostBpi) {
    const scheduleContract = ScheduleContract.bind(creditLineContract.schedule().getSchedule())
    if (isBeforeClose) {
      // Assume termStartTime will be 2 weeks after funding opens if it's not already known
      const startTime = scheduleContract.termStartTime(BigInt.fromI32(tranchedPool.fundableAt + twoWeeksSeconds))
      const periodsInTerm = scheduleContract.periodsInTerm()
      const interestPerSecond = tranchedPool.interestRateBigInt.div(secondsPerYear)

      let lastPeriodEndTime = startTime
      for (let period = 0; period < periodsInTerm.toI32(); period++) {
        const estimatedPaymentDate = scheduleContract.periodEndTime(startTime, BigInt.fromI32(period))
        const thisPeriodEndTime = scheduleContract.periodEndTime(startTime, BigInt.fromI32(period))
        const periodLengthSeconds = thisPeriodEndTime.minus(lastPeriodEndTime)
        lastPeriodEndTime = thisPeriodEndTime
        const interest = interestPerSecond
          .times(periodLengthSeconds)
          .times(tranchedPool.fundingLimit)
          .div(BigInt.fromString("1000000000000000000"))
        const principal = period == periodsInTerm.toI32() - 1 ? tranchedPool.fundingLimit : BigInt.zero()

        const scheduledRepayment = new ScheduledRepayment(`${tranchedPool.id}-${period.toString()}`)
        scheduledRepayment.loan = tranchedPool.id
        scheduledRepayment.estimatedPaymentDate = estimatedPaymentDate.toI32()
        scheduledRepayment.paymentPeriod = period
        scheduledRepayment.interest = interest
        scheduledRepayment.principal = principal
        scheduledRepayment.save()
        repaymentIds.push(scheduledRepayment.id)
      }
    } else {
      // Have to decrement by 1 or else the first period will accidentally be 1 further in the future
      const startTime = creditLineContract.termStartTime().minus(BigInt.fromI32(1))
      const periodsInTerm = scheduleContract.periodsInTerm()
      let prevInterest = BigInt.zero()
      let prevPrincipal = BigInt.zero()
      // TODO revisit this when we have access to the function for interestOwedAtSansLateFees
      for (let period = 0; period < periodsInTerm.toI32(); period++) {
        const estimatedPaymentDate = scheduleContract.periodEndTime(startTime, BigInt.fromI32(period))
        const interestOwedAt = creditLineContract.interestOwedAt(estimatedPaymentDate)
        const interest = interestOwedAt.minus(prevInterest)
        prevInterest = interestOwedAt
        const principalOwedAt = creditLineContract.principalOwedAt(estimatedPaymentDate)
        const principal = principalOwedAt.minus(prevPrincipal)
        prevPrincipal = principalOwedAt

        const scheduledRepayment = new ScheduledRepayment(`${tranchedPool.id}-${period.toString()}`)
        scheduledRepayment.loan = tranchedPool.id
        scheduledRepayment.estimatedPaymentDate = estimatedPaymentDate.toI32()
        scheduledRepayment.paymentPeriod = period
        scheduledRepayment.interest = interest
        scheduledRepayment.principal = principal
        scheduledRepayment.save()
        repaymentIds.push(scheduledRepayment.id)
      }
    }
  } else {
    const termInDays = creditLineContract.termInDays()
    const paymentPeriodInDays = creditLineContract.paymentPeriodInDays()
    const paymentPeriodInSeconds = paymentPeriodInDays.times(BigInt.fromI32(86400))
    const startTime = isBeforeClose
      ? BigInt.fromI32(tranchedPool.fundableAt + twoWeeksSeconds)
      : !cl_termStartTimeResult.reverted // no idea why this can revert
      ? cl_termStartTimeResult.value
      : BigInt.fromI32(tranchedPool.fundableAt)
    const periodsInTerm = termInDays.div(paymentPeriodInDays)
    const interestPerSecond = tranchedPool.interestRateBigInt.div(secondsPerYear)

    for (let period = 0; period < periodsInTerm.toI32(); period++) {
      const estimatedPaymentDate = startTime.plus(BigInt.fromI32(period + 1).times(paymentPeriodInSeconds))
      const interest = interestPerSecond
        .times(paymentPeriodInSeconds)
        .times(tranchedPool.fundingLimit)
        .div(BigInt.fromString("1000000000000000000"))
      const principal =
        period == periodsInTerm.toI32() - 1
          ? isBeforeClose
            ? tranchedPool.fundingLimit
            : tranchedPool.principalAmount
          : BigInt.zero()

      const scheduledRepayment = new ScheduledRepayment(`${tranchedPool.id}-${period.toString()}`)
      scheduledRepayment.loan = tranchedPool.id
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
export function deleteTranchedPoolRepaymentSchedule(tranchedPool: TranchedPool): void {
  const repaymentIds = tranchedPool.repaymentSchedule
  for (let i = 0; i < repaymentIds.length; i++) {
    store.remove("ScheduledRepayment", repaymentIds[i])
  }
  tranchedPool.repaymentSchedule = []
}

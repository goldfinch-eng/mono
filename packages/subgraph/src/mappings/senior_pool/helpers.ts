import {Address, BigDecimal, BigInt} from "@graphprotocol/graph-ts"

import {CreditLine, SeniorPool, TranchedPool} from "../../../generated/schema"
import {GoldfinchConfig} from "../../../generated/SeniorPool/GoldfinchConfig"
import {GOLDFINCH_CONFIG_ADDRESS, SENIOR_POOL_ADDRESS} from "../../address-manifest"
import {CONFIG_KEYS_NUMBERS, FIDU_DECIMALS, GFI_DECIMALS} from "../../constants"
import {getStakingRewards} from "../../entities/staking_rewards"

export function getOrInitSeniorPool(): SeniorPool {
  let seniorPool = SeniorPool.load("1")
  if (!seniorPool) {
    seniorPool = new SeniorPool("1")
    seniorPool.address = Address.fromString(SENIOR_POOL_ADDRESS)
    seniorPool.sharePrice = BigInt.zero()
    seniorPool.totalShares = BigInt.zero()
    seniorPool.assets = BigInt.zero()
    seniorPool.totalLoansOutstanding = BigInt.zero()
    seniorPool.tranchedPools = []

    const goldfinchConfigContract = GoldfinchConfig.bind(Address.fromString(GOLDFINCH_CONFIG_ADDRESS))
    const getNumberCallResult = goldfinchConfigContract.try_getNumber(
      BigInt.fromI32(CONFIG_KEYS_NUMBERS.SeniorPoolWithdrawalCancelationFeeInBps)
    )
    if (!getNumberCallResult.reverted) {
      seniorPool.withdrawalCancellationFee = getNumberCallResult.value.divDecimal(BigDecimal.fromString("10000"))
    } else {
      seniorPool.withdrawalCancellationFee = BigDecimal.zero()
    }

    seniorPool.estimatedTotalInterest = BigDecimal.zero()
    seniorPool.estimatedApy = BigDecimal.zero()
    seniorPool.estimatedApyFromGfiRaw = BigDecimal.zero()
    seniorPool.totalInvested = BigInt.zero()
    seniorPool.totalWrittenDown = BigInt.zero()
    seniorPool.defaultRate = BigDecimal.zero()

    seniorPool.save()
  }
  return seniorPool
}

function calculateEstimatedInterestForTranchedPool(tranchedPoolId: string): BigDecimal {
  const tranchedPool = TranchedPool.load(tranchedPoolId)
  if (!tranchedPool) {
    return BigDecimal.fromString("0")
  }
  const creditLine = CreditLine.load(tranchedPool.creditLine)
  if (!creditLine) {
    return BigDecimal.fromString("0")
  }

  const protocolFee = BigDecimal.fromString("0.1")
  const leverageRatio = tranchedPool.estimatedLeverageRatio
  const seniorFraction = leverageRatio
    ? leverageRatio.div(BigDecimal.fromString("1").plus(leverageRatio))
    : BigDecimal.fromString("1")
  const seniorBalance = creditLine.balance.toBigDecimal().times(seniorFraction)
  const juniorFeePercentage = tranchedPool.juniorFeePercent.toBigDecimal().div(BigDecimal.fromString("100"))
  const isV1Pool = tranchedPool.isV1StyleDeal
  const seniorPoolPercentageOfInterest = isV1Pool
    ? BigDecimal.fromString("1").minus(protocolFee)
    : BigDecimal.fromString("1").minus(juniorFeePercentage).minus(protocolFee)
  return seniorBalance.times(creditLine.interestAprDecimal).times(seniorPoolPercentageOfInterest)
}

class SeniorPoolApyCalcResult {
  estimatedApy: BigDecimal
  estimatedTotalInterest: BigDecimal
  constructor(estimatedApy: BigDecimal, estimatedTotalInterest: BigDecimal) {
    this.estimatedApy = estimatedApy
    this.estimatedTotalInterest = estimatedTotalInterest
  }
}

/**
 * Helper function that computes the senior pool APY based on the interest from tranched pools it has invested in and its current assets
 * @param seniorPool SeniorPool
 * @returns { estimatedApy: BigDecimal, estimatedTotalInterest: BigDecimal }
 */
export function calculateSeniorPoolApy(seniorPool: SeniorPool): SeniorPoolApyCalcResult {
  if (seniorPool.assets.isZero() || seniorPool.tranchedPools.length == 0) {
    return new SeniorPoolApyCalcResult(BigDecimal.zero(), BigDecimal.zero())
  }
  let estimatedTotalInterest = BigDecimal.zero()
  for (let i = 0; i < seniorPool.tranchedPools.length; i++) {
    const tranchedPoolId = seniorPool.tranchedPools[i]
    estimatedTotalInterest = estimatedTotalInterest.plus(calculateEstimatedInterestForTranchedPool(tranchedPoolId))
  }

  const estimatedApy = estimatedTotalInterest.div(seniorPool.assets.toBigDecimal())
  return new SeniorPoolApyCalcResult(estimatedApy, estimatedTotalInterest)
}

/**
 * Just a convenience function that will compute and set seniorPool.estimatedApy and seniorPool.estimatedTotalInterest
 * YOU STILL HAVE TO CALL seniorPool.save() AFTER CALLING THIS FUNCTION
 */
export function updateEstimatedSeniorPoolApy(seniorPool: SeniorPool): void {
  const apyCalcResult = calculateSeniorPoolApy(seniorPool)
  seniorPool.estimatedApy = apyCalcResult.estimatedApy
  seniorPool.estimatedTotalInterest = apyCalcResult.estimatedTotalInterest
}

export function calculateEstimatedApyFromGfiRaw(sharePrice: BigInt, currentEarnRatePerToken: BigInt): BigDecimal {
  if (sharePrice.isZero() || currentEarnRatePerToken.isZero()) {
    return BigDecimal.zero()
  }
  const SECONDS_PER_YEAR = BigInt.fromString("31536000")
  const estimatedApyFromGfiRaw = currentEarnRatePerToken
    .times(SECONDS_PER_YEAR)
    .toBigDecimal()
    .times(FIDU_DECIMALS.toBigDecimal()) // This might be better thought of as the share-price mantissa, which happens to be the same as `FIDU_DECIMALS`.
    .div(sharePrice.toBigDecimal())
    .div(GFI_DECIMALS.toBigDecimal())
  return estimatedApyFromGfiRaw
}

/**
 * Just a convenience function that will set seniorPool.estimatedApyFromGfiRaw. Used to reduce some repetitive code in the senior pool mappings
 * YOU STILL HAVE TO CALL seniorPool.save() AFTER CALLING THIS FUNCTION
 */
export function updateEstimatedApyFromGfiRaw(seniorPool: SeniorPool): void {
  const stakingRewards = getStakingRewards()
  seniorPool.estimatedApyFromGfiRaw = calculateEstimatedApyFromGfiRaw(
    seniorPool.sharePrice,
    stakingRewards.currentEarnRatePerToken
  )
}

export function calculateDefaultRate(totalWrittenDown: BigInt, totalInvested: BigInt): BigDecimal {
  if (totalWrittenDown.isZero() || totalInvested.isZero()) {
    return BigDecimal.zero()
  }
  return totalWrittenDown.toBigDecimal().div(totalInvested.toBigDecimal())
}

/**
 * Convenience function for setting seniorPool.defaultRate. Remember that you still must call seniorPool.save() after this.
 */
export function updateDefaultRate(seniorPool: SeniorPool): void {
  seniorPool.defaultRate = calculateDefaultRate(seniorPool.totalWrittenDown, seniorPool.totalInvested)
}

/**
 * The senior pool APY implicitly depends on the balance of credit lines. This convenience function has been provided to be called in TranchedPool mappings
 */
export function handleCreditLineBalanceChanged(): void {
  const seniorPool = getOrInitSeniorPool()
  updateEstimatedSeniorPoolApy(seniorPool)
  seniorPool.save()
}

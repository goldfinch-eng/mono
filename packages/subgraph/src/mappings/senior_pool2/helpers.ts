import {Address, BigDecimal, BigInt} from "@graphprotocol/graph-ts"

import {CreditLine, SeniorPool2, TranchedPool} from "../../../generated/schema"
import {GoldfinchConfig} from "../../../generated/SeniorPool/GoldfinchConfig"
import {GOLDFINCH_CONFIG_ADDRESS, SENIOR_POOL_ADDRESS} from "../../address-manifest"
import {CONFIG_KEYS_NUMBERS} from "../../constants"

export function getOrInitSeniorPool(): SeniorPool2 {
  let seniorPool = SeniorPool2.load("1")
  if (!seniorPool) {
    seniorPool = new SeniorPool2("1")
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
      seniorPool.cancellationFee = getNumberCallResult.value.divDecimal(BigDecimal.fromString("10000"))
    } else {
      seniorPool.cancellationFee = BigDecimal.zero()
    }

    seniorPool.estimatedTotalInterest = BigDecimal.zero()
    seniorPool.estimatedApy = BigDecimal.zero()
    seniorPool.estimatedApyFromGfiRaw = BigDecimal.zero()
    seniorPool.cumulativeDrawdowns = BigInt.zero()
    seniorPool.cumulativeWritedowns = BigInt.zero()
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
export function calculateSeniorPoolAPY(seniorPool: SeniorPool2): SeniorPoolApyCalcResult {
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

import {Address, BigDecimal, BigInt} from "@graphprotocol/graph-ts"
import {JuniorTrancheInfo, SeniorTrancheInfo, TranchedPool, CreditLine} from "../../generated/schema"
import {SeniorPool as SeniorPoolContract} from "../../generated/templates/GoldfinchFactory/SeniorPool"
import {GoldfinchConfig as GoldfinchConfigContract} from "../../generated/templates/GoldfinchFactory/GoldfinchConfig"
import {FixedLeverageRatioStrategy} from "../../generated/templates/TranchedPool/FixedLeverageRatioStrategy"
import {
  CONFIG_KEYS_NUMBERS,
  GOLDFINCH_CONFIG_ADDRESS,
  GOLDFINCH_LEGACY_CONFIG_ADDRESS,
  SENIOR_POOL_ADDRESS,
  OLD_FIXED_LEVERAGE_RATIO_ADDRESS,
} from "../constants"
import {MAINNET_METADATA} from "../metadata"
import {VERSION_BEFORE_V2_2} from "../utils"

const FIDU_DECIMAL_PLACES = 18
const FIDU_DECIMALS = BigInt.fromI32(10).pow(FIDU_DECIMAL_PLACES as u8)
const ONE = BigInt.fromString("1")
const ZERO = BigInt.fromString("0")
const ONE_HUNDRED = BigDecimal.fromString("100")

export function fiduFromAtomic(amount: BigInt): BigInt {
  return amount.div(FIDU_DECIMALS)
}

export function getTotalDeposited(
  address: Address,
  juniorTranches: JuniorTrancheInfo[],
  seniorTranches: SeniorTrancheInfo[]
): BigInt {
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

export function getJuniorDeposited(juniorTranches: JuniorTrancheInfo[]): BigInt {
  let juniorDeposited = BigInt.zero()
  for (let i = 0; i < juniorTranches.length; i++) {
    juniorDeposited = juniorDeposited.plus(juniorTranches[i].principalDeposited)
  }
  return juniorDeposited
}

export function getEstimatedSeniorPoolInvestment(tranchedPoolAddress: Address, tranchedPoolVersion: string): BigInt {
  if (tranchedPoolVersion == VERSION_BEFORE_V2_2) {
    // This means that the pool is not compatible with multiple slices, so we need to use a hack to estimate senior pool investment
    const fixedLeverageRatioStrategyContract = FixedLeverageRatioStrategy.bind(
      Address.fromString(OLD_FIXED_LEVERAGE_RATIO_ADDRESS)
    )
    return fixedLeverageRatioStrategyContract.estimateInvestment(
      Address.fromString(SENIOR_POOL_ADDRESS),
      tranchedPoolAddress
    )
  }
  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  return seniorPoolContract.estimateInvestment(tranchedPoolAddress)
}

export function getEstimatedTotalAssets(
  address: Address,
  juniorTranches: JuniorTrancheInfo[],
  seniorTranches: SeniorTrancheInfo[],
  version: string
): BigInt {
  let totalAssets = new BigInt(0)
  totalAssets = getTotalDeposited(address, juniorTranches, seniorTranches)

  let estimatedSeniorPoolContribution = getEstimatedSeniorPoolInvestment(address, version)
  totalAssets = totalAssets.plus(estimatedSeniorPoolContribution)
  return totalAssets
}

export function getGoldfinchConfig(timestamp: BigInt): GoldfinchConfigContract {
  const configAddress = timestamp.lt(BigInt.fromU64(1641349586))
    ? GOLDFINCH_LEGACY_CONFIG_ADDRESS
    : GOLDFINCH_CONFIG_ADDRESS
  return GoldfinchConfigContract.bind(Address.fromString(configAddress))
}

export function getLeverageRatio(timestamp: BigInt): BigInt {
  const goldfinchConfigContract = getGoldfinchConfig(timestamp)
  return goldfinchConfigContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.LeverageRatio)).div(FIDU_DECIMALS)
}

export function getReserveFeePercent(timestamp: BigInt): BigInt {
  const goldfinchConfigContract = getGoldfinchConfig(timestamp)
  return BigInt.fromI32(100).div(
    goldfinchConfigContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.ReserveDenominator))
  )
}

/**
 * This exists solely for legacy pools. It looks at a hard-coded metadata blob to determine whether a tranched pool's address is a known legacy pool
 */
export function isV1StyleDeal(address: Address): boolean {
  const poolMetadata = MAINNET_METADATA.get(address.toHexString())
  if (poolMetadata != null) {
    const isV1StyleDeal = poolMetadata.toObject().get("v1StyleDeal")
    if (isV1StyleDeal != null) {
      return isV1StyleDeal.toBool()
    }
  }
  return false
}

export function getCreatedAtOverride(address: Address): BigInt | null {
  const poolMetadata = MAINNET_METADATA.get(address.toHexString())
  if (poolMetadata != null) {
    const createdAt = poolMetadata.toObject().get("createdAt")
    if (createdAt != null) {
      return createdAt.toBigInt()
    }
  }
  return null
}

export function calculateEstimatedInterestForTranchedPool(tranchedPoolId: string): BigDecimal {
  const tranchedPool = TranchedPool.load(tranchedPoolId)
  if (!tranchedPool) {
    return BigDecimal.fromString("0")
  }
  const creditLine = CreditLine.load(tranchedPool.creditLine)
  if (!creditLine) {
    return BigDecimal.fromString("0")
  }

  const protocolFee = BigDecimal.fromString("0.1")
  const balance = creditLine.balance.toBigDecimal()
  const interestAprDecimal = creditLine.interestAprDecimal
  const juniorFeePercentage = tranchedPool.juniorFeePercent.toBigDecimal().div(ONE_HUNDRED)
  const isV1Pool = tranchedPool.isV1StyleDeal
  const seniorPoolPercentageOfInterest = BigDecimal.fromString("1")
    .minus(isV1Pool ? BigDecimal.fromString("0") : juniorFeePercentage)
    .minus(protocolFee)
  return balance.times(interestAprDecimal).times(seniorPoolPercentageOfInterest)
}

export function estimateJuniorAPY(tranchedPool: TranchedPool): BigDecimal {
  if (!tranchedPool) {
    return BigDecimal.fromString("0")
  }

  const creditLine = CreditLine.load(tranchedPool.creditLine)
  if (!creditLine) {
    throw new Error(`Missing creditLine for TranchedPool ${tranchedPool.id}`)
  }

  if (isV1StyleDeal(Address.fromString(tranchedPool.id))) {
    return creditLine.interestAprDecimal
  }

  let balance: BigInt
  if (!creditLine.balance.isZero()) {
    balance = creditLine.balance
  } else if (!creditLine.limit.isZero()) {
    balance = creditLine.limit
  } else if (!creditLine.maxLimit.isZero()) {
    balance = creditLine.maxLimit
  } else {
    return BigDecimal.fromString("0")
  }

  const leverageRatio = tranchedPool.estimatedLeverageRatio
  // A missing leverage ratio implies this was a v1 style deal and the senior pool supplied all the capital
  let seniorFraction = leverageRatio ? leverageRatio.divDecimal(ONE.plus(leverageRatio).toBigDecimal()) : ONE.toBigDecimal()
  let juniorFraction = leverageRatio ? ONE.divDecimal(ONE.plus(leverageRatio).toBigDecimal()) : ZERO.toBigDecimal()
  let interestRateFraction = creditLine.interestAprDecimal.div(ONE_HUNDRED)
  let juniorFeeFraction = tranchedPool.juniorFeePercent.divDecimal(ONE_HUNDRED)
  let reserveFeeFraction = tranchedPool.reserveFeePercent.divDecimal(ONE_HUNDRED)

  let grossSeniorInterest = balance.toBigDecimal().times(interestRateFraction).times(seniorFraction)
  let grossJuniorInterest = balance.toBigDecimal().times(interestRateFraction).times(juniorFraction)
  const juniorFee = grossSeniorInterest.times(juniorFeeFraction)

  const juniorReserveFeeOwed = grossJuniorInterest.times(reserveFeeFraction)
  let netJuniorInterest = grossJuniorInterest.plus(juniorFee).minus(juniorReserveFeeOwed)
  let juniorTranche = balance.toBigDecimal().times(juniorFraction)
  return netJuniorInterest.div(juniorTranche).times(ONE_HUNDRED)
}

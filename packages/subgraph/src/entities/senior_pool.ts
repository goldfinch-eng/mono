import {Address, BigDecimal, BigInt, log} from "@graphprotocol/graph-ts"
import {SeniorPool, SeniorPoolStatus} from "../../generated/schema"
import {SeniorPool as SeniorPoolContract} from "../../generated/templates/SeniorPool/SeniorPool"
import {Fidu_Implementation as FiduContract} from "../../generated/templates/SeniorPool/Fidu_Implementation"
import {FIDU_ADDRESS} from "../constants"
import {calculateEstimatedInterestForTranchedPool} from "./helpers"
import {getStakingRewards} from "./staking_rewards"

export function getOrInitSeniorPool(address: Address): SeniorPool {
  let seniorPool = SeniorPool.load(address.toHexString())
  if (!seniorPool) {
    seniorPool = new SeniorPool(address.toHexString())
    seniorPool.capitalProviders = []
    seniorPool.investmentsMade = []

    const poolStatus = getOrInitSeniorPoolStatus()

    seniorPool.latestPoolStatus = poolStatus.id
    seniorPool.save()
  }
  return seniorPool as SeniorPool
}

export const SENIOR_POOL_STATUS_ID = "1"
export function getOrInitSeniorPoolStatus(): SeniorPoolStatus {
  let poolStatus = SeniorPoolStatus.load(SENIOR_POOL_STATUS_ID)
  if (!poolStatus) {
    poolStatus = new SeniorPoolStatus(SENIOR_POOL_STATUS_ID)
    poolStatus.rawBalance = new BigInt(0)
    poolStatus.compoundBalance = new BigInt(0)
    poolStatus.balance = new BigInt(0)
    poolStatus.totalShares = new BigInt(0)
    poolStatus.sharePrice = new BigInt(0)
    poolStatus.totalPoolAssets = new BigInt(0)
    poolStatus.totalPoolAssetsUsdc = new BigInt(0)
    poolStatus.totalLoansOutstanding = new BigInt(0)
    poolStatus.cumulativeWritedowns = new BigInt(0)
    poolStatus.cumulativeDrawdowns = new BigInt(0)
    poolStatus.estimatedTotalInterest = BigDecimal.zero()
    poolStatus.estimatedApy = BigDecimal.zero()
    poolStatus.defaultRate = new BigInt(0)
    poolStatus.tranchedPools = []
    poolStatus.save()
  }
  return poolStatus
}

export function updateEstimatedApyFromGfiRaw(): void {
  const stakingRewards = getStakingRewards()
  const seniorPoolStatus = getOrInitSeniorPoolStatus()

  if (seniorPoolStatus.sharePrice != BigInt.zero()) {
    seniorPoolStatus.estimatedApyFromGfiRaw = stakingRewards.currentEarnRatePerToken
      .times(SECONDS_PER_YEAR)
      .toBigDecimal()
      .times(FIDU_DECIMALS.toBigDecimal()) // This might be better thought of as the share-price mantissa, which happens to be the same as `FIDU_DECIMALS`.
      .div(seniorPoolStatus.sharePrice.toBigDecimal())
      .div(GFI_DECIMALS.toBigDecimal())
    seniorPoolStatus.save()
  }
}

export function updatePoolCapitalProviders(seniorPoolAddress: Address, userAddress: Address): void {
  let seniorPool = getOrInitSeniorPool(seniorPoolAddress)
  let seniorPoolCapitalProviders = seniorPool.capitalProviders
  seniorPoolCapitalProviders.push(userAddress.toHexString())
  seniorPool.capitalProviders = seniorPoolCapitalProviders
  seniorPool.save()
}

const FIDU_DECIMALS = BigInt.fromString("1000000000000000000") // 18 zeroes
const GFI_DECIMALS = BigInt.fromString("1000000000000000000") // 18 zeroes
const USDC_DECIMALS = BigInt.fromString("1000000") // 6 zeroes
const SECONDS_PER_YEAR = BigInt.fromString("31536000")

export function updatePoolStatus(seniorPoolAddress: Address): void {
  let seniorPool = getOrInitSeniorPool(seniorPoolAddress)
  let fidu_contract = FiduContract.bind(Address.fromString(FIDU_ADDRESS))
  const stakingRewards = getStakingRewards()

  let contract = SeniorPoolContract.bind(seniorPoolAddress)
  let sharePrice = contract.sharePrice()
  let compoundBalance = contract.compoundBalance()
  let totalLoansOutstanding = contract.totalLoansOutstanding()
  let totalSupply = fidu_contract.totalSupply()
  let totalPoolAssets = totalSupply.times(sharePrice)
  let totalPoolAssetsUsdc = totalPoolAssets.times(USDC_DECIMALS).div(FIDU_DECIMALS).div(FIDU_DECIMALS)
  let balance = contract.assets().minus(contract.totalLoansOutstanding()).plus(contract.totalWritedowns())
  let rawBalance = balance

  let poolStatus = SeniorPoolStatus.load(seniorPool.latestPoolStatus) as SeniorPoolStatus
  poolStatus.compoundBalance = compoundBalance
  poolStatus.totalLoansOutstanding = totalLoansOutstanding
  poolStatus.totalShares = totalSupply
  poolStatus.balance = balance
  poolStatus.sharePrice = sharePrice
  poolStatus.rawBalance = rawBalance
  poolStatus.totalPoolAssets = totalPoolAssets
  poolStatus.totalPoolAssetsUsdc = totalPoolAssetsUsdc
  poolStatus.save()
  recalculateSeniorPoolAPY(poolStatus)
  updateEstimatedApyFromGfiRaw()

  seniorPool.latestPoolStatus = poolStatus.id
  seniorPool.save()
}

export function updatePoolInvestments(seniorPoolAddress: Address, tranchedPoolAddress: Address): void {
  let seniorPool = getOrInitSeniorPool(seniorPoolAddress)
  let investments = seniorPool.investmentsMade
  investments.push(tranchedPoolAddress.toHexString())
  seniorPool.investmentsMade = investments
  seniorPool.save()
}

export function recalculateSeniorPoolAPY(poolStatus: SeniorPoolStatus): void {
  let estimatedTotalInterest = BigDecimal.zero()
  for (let i = 0; i < poolStatus.tranchedPools.length; i++) {
    const tranchedPoolId = poolStatus.tranchedPools[i]
    if (!tranchedPoolId) {
      continue
    }
    estimatedTotalInterest = estimatedTotalInterest.plus(calculateEstimatedInterestForTranchedPool(tranchedPoolId))
  }
  poolStatus.estimatedTotalInterest = estimatedTotalInterest

  if (poolStatus.totalPoolAssets.notEqual(BigInt.zero())) {
    // The goofy-looking math here is required to get things in the right units for arithmetic
    const totalPoolAssetsInDollars = poolStatus.totalPoolAssets
      .toBigDecimal()
      .div(FIDU_DECIMALS.toBigDecimal())
      .div(FIDU_DECIMALS.toBigDecimal())
      .times(USDC_DECIMALS.toBigDecimal())
    let estimatedApy = estimatedTotalInterest.div(totalPoolAssetsInDollars)
    poolStatus.estimatedApy = estimatedApy
  }

  poolStatus.save()
}

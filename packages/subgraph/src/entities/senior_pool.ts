import {Address, BigDecimal, BigInt} from "@graphprotocol/graph-ts"
import {SeniorPool, SeniorPoolStatus} from "../../generated/schema"
import {SeniorPool as SeniorPoolContract} from "../../generated/SeniorPool/SeniorPool"
import {GoldfinchConfig as GoldfinchConfigContract} from "../../generated/templates/TranchedPool/GoldfinchConfig"
import {Fidu as FiduContract} from "../../generated/SeniorPool/Fidu"
import {CONFIG_KEYS_ADDRESSES, CONFIG_KEYS_NUMBERS} from "../constants"
import {calculateEstimatedInterestForTranchedPool} from "./helpers"
import {getStakingRewards} from "./staking_rewards"
import {getAddressFromConfig} from "../utils"

export function getOrInitSeniorPool(address: Address): SeniorPool {
  let seniorPool = SeniorPool.load(address.toHexString())
  if (!seniorPool) {
    seniorPool = new SeniorPool(address.toHexString())
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
    poolStatus.balance = new BigInt(0)
    poolStatus.totalShares = new BigInt(0)
    poolStatus.sharePrice = new BigInt(0)
    poolStatus.assets = BigInt.zero()
    poolStatus.totalLoansOutstanding = new BigInt(0)
    poolStatus.cumulativeWritedowns = new BigInt(0)
    poolStatus.cumulativeDrawdowns = new BigInt(0)
    poolStatus.estimatedTotalInterest = BigDecimal.zero()
    poolStatus.estimatedApy = BigDecimal.zero()
    poolStatus.estimatedApyFromGfiRaw = BigDecimal.zero()
    poolStatus.defaultRate = new BigInt(0)
    poolStatus.tranchedPools = []
    poolStatus.cancellationFee = BigDecimal.zero()
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

const FIDU_DECIMALS = BigInt.fromString("1000000000000000000") // 18 zeroes
const GFI_DECIMALS = BigInt.fromString("1000000000000000000") // 18 zeroes
const USDC_DECIMALS = BigInt.fromString("1000000") // 6 zeroes
const SECONDS_PER_YEAR = BigInt.fromString("31536000")

export function updatePoolStatus(seniorPoolAddress: Address): void {
  const seniorPool = getOrInitSeniorPool(seniorPoolAddress)

  const seniorPoolContract = SeniorPoolContract.bind(seniorPoolAddress)
  const goldfinchConfigContract = GoldfinchConfigContract.bind(seniorPoolContract.config())
  const fidu_contract = FiduContract.bind(getAddressFromConfig(seniorPoolContract, CONFIG_KEYS_ADDRESSES.Fidu))

  const sharePrice = seniorPoolContract.sharePrice()
  const totalLoansOutstanding = seniorPoolContract.totalLoansOutstanding()
  const totalSupply = fidu_contract.totalSupply()
  const assets = seniorPoolContract.try_assets()
  const balance = seniorPoolContract
    .assets()
    .minus(seniorPoolContract.totalLoansOutstanding())
    .plus(seniorPoolContract.totalWritedowns())
  const rawBalance = balance
  const cancellationFee = goldfinchConfigContract.getNumber(
    BigInt.fromI32(CONFIG_KEYS_NUMBERS.SeniorPoolWithdrawalCancelationFeeInBps)
  )

  const poolStatus = SeniorPoolStatus.load(seniorPool.latestPoolStatus) as SeniorPoolStatus
  poolStatus.totalLoansOutstanding = totalLoansOutstanding
  poolStatus.totalShares = totalSupply
  poolStatus.balance = balance
  poolStatus.sharePrice = sharePrice
  poolStatus.rawBalance = rawBalance
  poolStatus.assets = !assets.reverted
    ? assets.value
    : // total supply is in FIDU (1e18) and sharePrice is also 1e18, so we need to multiply by USDC_DECIMALS and then divide out FIDU_DECIMALS twice get back to 1e6
      totalSupply.times(sharePrice).times(USDC_DECIMALS).div(FIDU_DECIMALS).div(FIDU_DECIMALS)
  poolStatus.cancellationFee = new BigDecimal(cancellationFee).div(BigDecimal.fromString("10000"))
  poolStatus.save()
  recalculateSeniorPoolAPY(poolStatus)
  updateEstimatedApyFromGfiRaw()

  seniorPool.latestPoolStatus = poolStatus.id
  seniorPool.save()
}

export function updatePoolInvestments(tranchedPoolAddress: Address): void {
  const poolStatus = assert(SeniorPoolStatus.load("1"))
  const addressAsString = tranchedPoolAddress.toHexString()
  if (!poolStatus.tranchedPools.includes(addressAsString)) {
    poolStatus.tranchedPools = poolStatus.tranchedPools.concat([addressAsString])
    poolStatus.save()
  }
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

  if (poolStatus.assets.notEqual(BigInt.zero())) {
    poolStatus.estimatedApy = estimatedTotalInterest.div(poolStatus.assets.toBigDecimal())
  }

  poolStatus.save()
}

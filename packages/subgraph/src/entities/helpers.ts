import { Address, BigInt } from '@graphprotocol/graph-ts'
import { JuniorTrancheInfo, SeniorTrancheInfo } from "../../generated/schema"
import { SeniorPool as SeniorPoolContract } from '../../generated/templates/GoldfinchFactory/SeniorPool'
import { GoldfinchConfig as GoldfinchConfigContract } from '../../generated/templates/GoldfinchFactory/GoldfinchConfig'
import { FixedLeverageRatioStrategy } from "../../generated/templates/TranchedPool/FixedLeverageRatioStrategy"
import { CONFIG_KEYS_NUMBERS, GOLDFINCH_CONFIG_ADDRESS, OLD_FIXED_LEVERAGE_RATIO_ADDRESS, SENIOR_POOL_ADDRESS } from '../constants'

const FIDU_DECIMAL_PLACES = 18
const FIDU_DECIMALS = BigInt.fromI32(10).pow(FIDU_DECIMAL_PLACES as u8)

export function fiduFromAtomic(amount: BigInt): BigInt {
  return amount.div(FIDU_DECIMALS)
}

export function getTotalDeposited(address: Address, juniorTranches: JuniorTrancheInfo[], seniorTranches: SeniorTrancheInfo[]): BigInt {
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

export function getEstimatedSeniorPoolInvestment(tranchedPoolAddress: Address):BigInt {
  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  const estimateInvestmentCall = seniorPoolContract.try_estimateInvestment(tranchedPoolAddress)
  if (!estimateInvestmentCall.reverted) {
    return estimateInvestmentCall.value
  }
  const fixedLeverageRatioStrategyContract = FixedLeverageRatioStrategy.bind(Address.fromString(OLD_FIXED_LEVERAGE_RATIO_ADDRESS))
  return fixedLeverageRatioStrategyContract.estimateInvestment(Address.fromString(SENIOR_POOL_ADDRESS), tranchedPoolAddress)
}

export function getEstimatedTotalAssets(address: Address, juniorTranches: JuniorTrancheInfo[], seniorTranches: SeniorTrancheInfo[]): BigInt {
  let totalAssets = new BigInt(0)
  totalAssets = getTotalDeposited(address, juniorTranches, seniorTranches)

  let estimatedSeniorPoolContribution = getEstimatedSeniorPoolInvestment(address)
  totalAssets = totalAssets.plus(estimatedSeniorPoolContribution)
  return totalAssets
}

export function getEstimatedLeverageRatio(address: Address, juniorTranches: JuniorTrancheInfo[], seniorTranches: SeniorTrancheInfo[]): BigInt {
  let juniorContribution = new BigInt(0)

  for (let i = 0, k = juniorTranches.length; i < k; ++i) {
    let tranche = assert(juniorTranches[i])
    juniorContribution = juniorContribution.plus(tranche.principalDeposited)
  }

  if (juniorContribution.isZero()) {
    const configContract = GoldfinchConfigContract.bind(Address.fromString(GOLDFINCH_CONFIG_ADDRESS))
    const rawLeverageRatio = configContract.getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.LeverageRatio))
    return fiduFromAtomic(rawLeverageRatio)
  }

  const totalAssets = getEstimatedTotalAssets(address, juniorTranches, seniorTranches)
  const estimatedLeverageRatio = totalAssets.minus(juniorContribution).div(juniorContribution)
  return estimatedLeverageRatio
}

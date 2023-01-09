import {Address, BigDecimal, BigInt} from "@graphprotocol/graph-ts"

import {SeniorPool2} from "../../../generated/schema"
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
    seniorPool.cancellationFee = goldfinchConfigContract
      .getNumber(BigInt.fromI32(CONFIG_KEYS_NUMBERS.SeniorPoolWithdrawalCancelationFeeInBps))
      .divDecimal(BigDecimal.fromString("10000"))

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

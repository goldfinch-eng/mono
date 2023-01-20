import {BigDecimal} from "@graphprotocol/graph-ts"

import {NumberUpdated} from "../../generated/GoldfinchConfig/GoldfinchConfig"
import {CONFIG_KEYS_NUMBERS} from "../constants"
import {getOrInitSeniorPool} from "./senior_pool/helpers"

export function handleNumberUpdated(event: NumberUpdated): void {
  if (event.params.index.toI32() == CONFIG_KEYS_NUMBERS.SeniorPoolWithdrawalCancelationFeeInBps) {
    const seniorPool = getOrInitSeniorPool()
    seniorPool.withdrawalCancellationFee = event.params.newValue.divDecimal(BigDecimal.fromString("10000"))
    seniorPool.save()
  }
}

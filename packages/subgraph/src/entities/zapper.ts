import {Address, store} from "@graphprotocol/graph-ts"
import {SeniorPoolStakedPosition, Zap} from "../../generated/schema"
import {SeniorPool as SeniorPoolContract} from "../../generated/templates/SeniorPool/SeniorPool"
import {Zapper as ZapperContract} from "../../generated/templates/TranchedPool/Zapper"
import {
  DepositMade as TranchedPoolDepositMade,
  WithdrawalMade as TranchedPoolWithdrawalMade,
} from "../../generated/templates/TranchedPool/TranchedPool"
import {Transfer as PoolTokenTransfer} from "../../generated/PoolTokensProxy/PoolTokens"

import {SENIOR_POOL_ADDRESS} from "../constants"

export function createZapMaybe(event: TranchedPoolDepositMade): void {
  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  const zapperRole = seniorPoolContract.try_ZAPPER_ROLE()
  // zapper may not exist yet on mainnet
  if (zapperRole.reverted) {
    return
  }
  const wasDoneByZapper = seniorPoolContract.hasRole(zapperRole.value, event.params.owner)
  if (wasDoneByZapper) {
    const zap = new Zap(event.params.tokenId.toString())
    zap.poolToken = event.params.tokenId.toString()
    zap.tranchedPool = event.address.toHexString()
    zap.amount = event.params.amount
    const zapperContract = ZapperContract.bind(event.params.owner)
    const zapInfo = zapperContract.tranchedPoolZaps(event.params.tokenId)
    zap.user = zapInfo.value0.toHexString()
    zap.seniorPoolStakedPosition = zapInfo.value1.toString()
    zap.save()
  }
}

export function deleteZapAfterUnzapMaybe(event: TranchedPoolWithdrawalMade): void {
  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  const zapperRole = seniorPoolContract.try_ZAPPER_ROLE()
  // zapper may not exist yet on mainnet
  if (zapperRole.reverted) {
    return
  }
  const wasDoneByZapper = seniorPoolContract.hasRole(zapperRole.value, event.params.owner)
  if (wasDoneByZapper) {
    const zap = assert(Zap.load(event.params.tokenId.toString()))
    store.remove("Zap", zap.id)
    const seniorPoolStakedPosition = assert(SeniorPoolStakedPosition.load(zap.seniorPoolStakedPosition))
    const fiduToAddBack = seniorPoolContract.getNumShares(event.params.principalWithdrawn)
    seniorPoolStakedPosition.amount = seniorPoolStakedPosition.amount.plus(fiduToAddBack)
    seniorPoolStakedPosition.save()
  }
}

export function deleteZapAfterClaimMaybe(event: PoolTokenTransfer): void {
  const seniorPoolContract = SeniorPoolContract.bind(Address.fromString(SENIOR_POOL_ADDRESS))
  const zapperRole = seniorPoolContract.try_ZAPPER_ROLE()
  // zapper may not exist yet on mainnet
  if (zapperRole.reverted) {
    return
  }
  const wasDoneByZapper = seniorPoolContract.hasRole(zapperRole.value, event.params.from)
  if (wasDoneByZapper) {
    const zap = assert(Zap.load(event.params.tokenId.toString()))
    store.remove("Zap", zap.id)
  }
}

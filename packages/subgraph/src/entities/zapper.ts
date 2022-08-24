import {store, BigInt} from "@graphprotocol/graph-ts"
import {SeniorPoolStakedPosition, Zap} from "../../generated/schema"
import {SeniorPool as SeniorPoolContract} from "../../generated/SeniorPool/SeniorPool"
import {Zapper as ZapperContract} from "../../generated/templates/TranchedPool/Zapper"
import {
  TranchedPool as TranchedPoolContract,
  DepositMade as TranchedPoolDepositMade,
  WithdrawalMade as TranchedPoolWithdrawalMade,
} from "../../generated/templates/TranchedPool/TranchedPool"
import {GoldfinchConfig as GoldfinchConfigContract_TranchedPool} from "../../generated/templates/TranchedPool/GoldfinchConfig"
import {PoolTokens as PoolTokensContract, Transfer as PoolTokenTransfer} from "../../generated/PoolTokens/PoolTokens"
import {GoldfinchConfig as GoldfinchConfigContract_PoolTokens} from "../../generated/PoolTokens/GoldfinchConfig"

import {CONFIG_KEYS_ADDRESSES} from "../constants"

export function createZapMaybe(event: TranchedPoolDepositMade): void {
  const tranchedPoolContract = TranchedPoolContract.bind(event.address)
  const goldfinchConfigContract = GoldfinchConfigContract_TranchedPool.bind(tranchedPoolContract.config())
  const seniorPoolAddress = goldfinchConfigContract.getAddress(BigInt.fromI32(CONFIG_KEYS_ADDRESSES.SeniorPool))
  const seniorPoolContract = SeniorPoolContract.bind(seniorPoolAddress)

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
  const tranchedPoolContract = TranchedPoolContract.bind(event.address)
  const goldfinchConfigContract = GoldfinchConfigContract_TranchedPool.bind(tranchedPoolContract.config())
  const seniorPoolAddress = goldfinchConfigContract.getAddress(BigInt.fromI32(CONFIG_KEYS_ADDRESSES.SeniorPool))
  const seniorPoolContract = SeniorPoolContract.bind(seniorPoolAddress)

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
  const tranchedPoolContract = PoolTokensContract.bind(event.address)
  const goldfinchConfigContract = GoldfinchConfigContract_PoolTokens.bind(tranchedPoolContract.config())
  const seniorPoolAddress = goldfinchConfigContract.getAddress(BigInt.fromI32(CONFIG_KEYS_ADDRESSES.SeniorPool))
  const seniorPoolContract = SeniorPoolContract.bind(seniorPoolAddress)

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

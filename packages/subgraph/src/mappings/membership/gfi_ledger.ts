import {store} from "@graphprotocol/graph-ts"
import {GFIDeposit, GFIWithdrawal} from "../../../generated/GFILedger/GFILedger"
import {VaultedGfi} from "../../../generated/schema"

export function handleGfiDeposit(event: GFIDeposit): void {
  const vaultedGfi = new VaultedGfi(event.params.tokenId.toString())
  vaultedGfi.amount = event.params.amount
  vaultedGfi.user = event.params.owner.toHexString()
  vaultedGfi.vaultedAt = event.params.depositTimestamp.toI32()
  vaultedGfi.save()
}

export function handleGfiWithdraw(event: GFIWithdrawal): void {
  if (event.params.remainingAmount.isZero()) {
    store.remove("VaultedGfi", event.params.tokenId.toString())
  } else {
    const vaultedGfi = assert(VaultedGfi.load(event.params.tokenId.toString()))
    vaultedGfi.amount = event.params.remainingAmount
    vaultedGfi.save()
  }
}

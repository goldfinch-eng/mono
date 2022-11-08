import {log, store} from "@graphprotocol/graph-ts"

import {CapitalERC721Deposit, CapitalERC721Withdrawal} from "../../../generated/CapitalLedger/CapitalLedger"
import {VaultedStakedPosition, VaultedPoolToken, TranchedPoolToken} from "../../../generated/schema"

import {STAKING_REWARDS_ADDRESS, POOL_TOKENS_ADDRESS} from "../../address-manifest"

export function handleCapitalErc721Deposit(event: CapitalERC721Deposit): void {
  const assetAddress = event.params.assetAddress.toHexString()
  if (assetAddress == STAKING_REWARDS_ADDRESS) {
    const vaultedStakedPosition = new VaultedStakedPosition(event.params.positionId.toString())
    vaultedStakedPosition.user = event.params.owner.toHexString()
    vaultedStakedPosition.usdcEquivalent = event.params.usdcEquivalent
    vaultedStakedPosition.vaultedAt = event.block.timestamp.toI32()
    vaultedStakedPosition.seniorPoolStakedPosition = event.params.assetTokenId.toString()
    vaultedStakedPosition.save()
  } else if (assetAddress == POOL_TOKENS_ADDRESS) {
    const vaultedPoolToken = new VaultedPoolToken(event.params.positionId.toString())
    vaultedPoolToken.user = event.params.owner.toHexString()
    vaultedPoolToken.usdcEquivalent = event.params.usdcEquivalent
    vaultedPoolToken.vaultedAt = event.block.timestamp.toI32()
    vaultedPoolToken.poolToken = event.params.assetTokenId.toString()
    const poolToken = assert(TranchedPoolToken.load(event.params.assetTokenId.toString()))
    vaultedPoolToken.tranchedPool = poolToken.tranchedPool
    vaultedPoolToken.save()
  }
}

export function handleCapitalErc721Withdrawal(event: CapitalERC721Withdrawal): void {
  const id = event.params.positionId.toString()
  if (store.get("VaultedStakedPosition", id) != null) {
    store.remove("VaultedStakedPosition", id)
  } else if (store.get("VaultedPoolToken", id) != null) {
    store.remove("VaultedPoolToken", id)
  }
}

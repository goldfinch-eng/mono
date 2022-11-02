import {log, store} from "@graphprotocol/graph-ts"

import {CapitalERC721Deposit, CapitalWithdrawal} from "../../../generated/CapitalLedger/CapitalLedger"
import {VaultedStakedPosition, VaultedPoolToken} from "../../../generated/schema"

import {STAKING_REWARDS_ADDRESS, POOL_TOKENS_ADDRESS} from "../../address-manifest"

export function handleCapitalErc721Deposit(event: CapitalERC721Deposit): void {
  const assetAddress = event.params.assetAddress.toHexString()
  if (assetAddress == STAKING_REWARDS_ADDRESS) {
    const vaultedStakedPosition = new VaultedStakedPosition(event.params.tokenId.toString())
    vaultedStakedPosition.user = event.params.owner.toHexString()
    vaultedStakedPosition.usdcEquivalent = event.params.usdcEquivalent
    vaultedStakedPosition.vaultedAt = event.block.timestamp.toI32()
    vaultedStakedPosition.seniorPoolStakedPosition = event.params.assetId.toString()
    vaultedStakedPosition.save()
  } else if (assetAddress == POOL_TOKENS_ADDRESS) {
    const vaultedPoolToken = new VaultedPoolToken(event.params.tokenId.toString())
    vaultedPoolToken.user = event.params.owner.toHexString()
    vaultedPoolToken.usdcEquivalent = event.params.usdcEquivalent
    vaultedPoolToken.vaultedAt = event.block.timestamp.toI32()
    vaultedPoolToken.poolToken = event.params.assetId.toString()
    vaultedPoolToken.save()
  }
}

export function handleCapitalWithdrawal(event: CapitalWithdrawal): void {
  const id = event.params.tokenId.toString()
  if (store.get("VaultedStakedPosition", id) != null) {
    store.remove("VaultedStakedPosition", id)
  } else if (store.get("VaultedPoolToken", id) != null) {
    store.remove("VaultedPoolToken", id)
  }
}

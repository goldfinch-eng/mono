import {store} from "@graphprotocol/graph-ts"

import {CapitalERC721Deposit, CapitalERC721Withdrawal} from "../../../generated/CapitalLedger/CapitalLedger"
import {VaultedStakedPosition, VaultedPoolToken, PoolToken, SeniorPoolStakedPosition} from "../../../generated/schema"

import {STAKING_REWARDS_ADDRESS, POOL_TOKENS_ADDRESS} from "../../address-manifest"
import {createTransactionFromEvent} from "../../entities/helpers"

export function handleCapitalErc721Deposit(event: CapitalERC721Deposit): void {
  const assetAddress = event.params.assetAddress.toHexString()
  if (assetAddress == STAKING_REWARDS_ADDRESS) {
    const vaultedStakedPosition = new VaultedStakedPosition(event.params.positionId.toString())
    vaultedStakedPosition.user = event.params.owner.toHexString()
    vaultedStakedPosition.usdcEquivalent = event.params.usdcEquivalent
    vaultedStakedPosition.vaultedAt = event.block.timestamp.toI32()
    vaultedStakedPosition.seniorPoolStakedPosition = event.params.assetTokenId.toString()
    vaultedStakedPosition.save()
    const stakedPosition = assert(SeniorPoolStakedPosition.load(event.params.assetTokenId.toString()))
    stakedPosition.vaultedAsset = vaultedStakedPosition.id
    stakedPosition.save()

    const transaction = createTransactionFromEvent(event, "MEMBERSHIP_CAPITAL_DEPOSIT", event.params.owner)
    transaction.sentNftId = event.params.assetTokenId.toString()
    transaction.sentNftType = "STAKING_TOKEN"
    transaction.save()
  } else if (assetAddress == POOL_TOKENS_ADDRESS) {
    const vaultedPoolToken = new VaultedPoolToken(event.params.positionId.toString())
    vaultedPoolToken.user = event.params.owner.toHexString()
    vaultedPoolToken.usdcEquivalent = event.params.usdcEquivalent
    vaultedPoolToken.vaultedAt = event.block.timestamp.toI32()
    vaultedPoolToken.poolToken = event.params.assetTokenId.toString()
    const poolToken = assert(PoolToken.load(event.params.assetTokenId.toString()))
    vaultedPoolToken.loan = poolToken.loan
    vaultedPoolToken.save()
    poolToken.vaultedAsset = vaultedPoolToken.id
    poolToken.save()

    const transaction = createTransactionFromEvent(event, "MEMBERSHIP_CAPITAL_DEPOSIT", event.params.owner)
    transaction.sentNftId = event.params.assetTokenId.toString()
    transaction.sentNftType = "POOL_TOKEN"
    transaction.save()
  }
}

export function handleCapitalErc721Withdrawal(event: CapitalERC721Withdrawal): void {
  const id = event.params.positionId.toString()
  const vaultedStakedPosition = VaultedStakedPosition.load(id)
  const vaultedPoolToken = VaultedPoolToken.load(id)
  if (vaultedStakedPosition != null) {
    const transaction = createTransactionFromEvent(event, "MEMBERSHIP_CAPITAL_WITHDRAWAL", event.params.owner)
    transaction.receivedNftId = vaultedStakedPosition.seniorPoolStakedPosition
    transaction.receivedNftType = "STAKING_TOKEN"
    transaction.save()

    store.remove("VaultedStakedPosition", id)

    const stakedPosition = assert(SeniorPoolStakedPosition.load(vaultedStakedPosition.seniorPoolStakedPosition))
    stakedPosition.vaultedAsset = null
    stakedPosition.save()
  } else if (vaultedPoolToken != null) {
    const transaction = createTransactionFromEvent(event, "MEMBERSHIP_CAPITAL_WITHDRAWAL", event.params.owner)
    transaction.receivedNftId = vaultedPoolToken.poolToken
    transaction.receivedNftType = "POOL_TOKEN"
    transaction.save()

    store.remove("VaultedPoolToken", id)

    const poolToken = assert(PoolToken.load(vaultedPoolToken.poolToken))
    poolToken.vaultedAsset = null
    poolToken.save()
  }
}

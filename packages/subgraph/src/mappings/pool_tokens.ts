import {BigInt, store} from "@graphprotocol/graph-ts"
import {
  TokenBurned,
  TokenMinted,
  TokenRedeemed,
  Transfer,
  TokenPrincipalWithdrawn,
} from "../../generated/PoolTokens/PoolTokens"
import {TranchedPool, TranchedPoolToken} from "../../generated/schema"
import {getOrInitUser} from "../entities/user"
import {deleteZapAfterClaimMaybe} from "../entities/zapper"

export function handleTokenBurned(event: TokenBurned): void {
  const token = TranchedPoolToken.load(event.params.tokenId.toString())
  if (!token) {
    return
  }
  store.remove("TranchedPoolToken", event.params.tokenId.toString())
}

export function handleTokenMinted(event: TokenMinted): void {
  const tranchedPool = TranchedPool.load(event.params.pool.toHexString())
  if (tranchedPool) {
    const token = new TranchedPoolToken(event.params.tokenId.toString())
    token.mintedAt = event.block.timestamp
    token.user = event.params.owner.toHexString()
    token.tranchedPool = tranchedPool.id
    token.tranche = event.params.tranche
    token.principalAmount = event.params.amount
    token.principalRedeemed = BigInt.zero()
    token.principalRedeemable = token.principalAmount
    token.interestRedeemed = BigInt.zero()
    token.interestRedeemable = BigInt.zero()
    token.rewardsClaimable = BigInt.zero()
    token.rewardsClaimed = BigInt.zero()
    token.stakingRewardsClaimable = BigInt.zero()
    token.stakingRewardsClaimed = BigInt.zero()
    token.save()

    const tokensOnPool = tranchedPool.tokens
    tokensOnPool.push(token.id)
    tranchedPool.tokens = tokensOnPool
    tranchedPool.save()
  }
}

export function handleTokenRedeemed(event: TokenRedeemed): void {
  const token = TranchedPoolToken.load(event.params.tokenId.toString())
  if (!token) {
    return
  }
  token.interestRedeemable = token.interestRedeemable.minus(event.params.interestRedeemed)
  token.interestRedeemed = token.interestRedeemed.plus(event.params.interestRedeemed)
  token.principalRedeemable = token.principalRedeemable.minus(event.params.principalRedeemed)
  token.principalRedeemed = token.principalRedeemed.plus(event.params.principalRedeemed)
  token.save()
}

export function handleTokenPrincipalWithdrawn(event: TokenPrincipalWithdrawn): void {
  const token = TranchedPoolToken.load(event.params.tokenId.toString())
  if (!token) {
    return
  }
  token.principalAmount = token.principalAmount.minus(event.params.principalWithdrawn)
  token.principalRedeemable = token.principalRedeemable.minus(event.params.principalWithdrawn)
  token.save()
}

export function handleTransfer(event: Transfer): void {
  const token = TranchedPoolToken.load(event.params.tokenId.toString())
  if (!token) {
    return
  }
  const newOwner = getOrInitUser(event.params.to)
  token.user = newOwner.id
  token.save()
  deleteZapAfterClaimMaybe(event)
}

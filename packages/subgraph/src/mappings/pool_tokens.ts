import {BigInt, store} from "@graphprotocol/graph-ts"
import {
  TokenBurned,
  TokenMinted,
  TokenRedeemed,
  Transfer,
  TokenPrincipalWithdrawn,
} from "../../generated/PoolTokens/PoolTokens"
import {TranchedPool as TranchedPoolContract} from "../../generated/PoolTokens/TranchedPool"
import {CallableLoan as CallableLoanContract} from "../../generated/PoolTokens/CallableLoan"
import {TranchedPool, PoolToken, User, CallableLoan} from "../../generated/schema"
import {getOrInitUser} from "../entities/user"
import {deleteZapAfterClaimMaybe} from "../entities/zapper"
import {removeFromList} from "../utils"

export function handleTokenBurned(event: TokenBurned): void {
  const burnedTokenId = event.params.tokenId.toString()
  const token = PoolToken.load(burnedTokenId)
  if (!token) {
    return
  }
  store.remove("PoolToken", burnedTokenId)

  // Remove the token from both the user and tranched pool's token list
  const tranchedPool = TranchedPool.load(event.params.pool.toHexString())
  const callableLoan = CallableLoan.load(event.params.pool.toHexString())
  const user = getOrInitUser(event.params.owner)

  if (tranchedPool) {
    tranchedPool.tokens = removeFromList(tranchedPool.tokens, burnedTokenId)
    user.poolTokens = removeFromList(user.poolTokens, burnedTokenId)
    tranchedPool.save()
    user.save()
  } else if (callableLoan) {
    callableLoan.tokens = removeFromList(callableLoan.tokens, burnedTokenId)
    user.poolTokens = removeFromList(user.poolTokens, burnedTokenId)
    callableLoan.save()
    user.save()
  }
}

export function handleTokenMinted(event: TokenMinted): void {
  const tranchedPool = TranchedPool.load(event.params.pool.toHexString())
  const tranchedPoolContract = TranchedPoolContract.bind(event.params.pool)
  const callableLoan = CallableLoan.load(event.params.pool.toHexString())
  const callableLoanContract = CallableLoanContract.bind(event.params.pool)
  const user = getOrInitUser(event.params.owner)
  if (tranchedPool || callableLoan) {
    const token = new PoolToken(event.params.tokenId.toString())
    token.mintedAt = event.block.timestamp
    token.user = user.id
    token.tranche = event.params.tranche
    token.principalAmount = event.params.amount
    token.principalRedeemed = BigInt.zero()
    token.principalRedeemable = token.principalAmount
    if (tranchedPool) {
      const result = tranchedPoolContract.try_availableToWithdraw(event.params.tokenId)
      if (!result.reverted) {
        token.principalRedeemable = result.value.value1
      }
    } else if (callableLoan) {
      const result = callableLoanContract.try_availableToWithdraw(event.params.tokenId)
      if (!result.reverted) {
        token.principalRedeemable = result.value.value1
      }
    }
    token.interestRedeemed = BigInt.zero()
    token.interestRedeemable = BigInt.zero()
    token.rewardsClaimable = BigInt.zero()
    token.rewardsClaimed = BigInt.zero()
    token.stakingRewardsClaimable = BigInt.zero()
    token.stakingRewardsClaimed = BigInt.zero()
    token.isCapitalCalled = false
    if (tranchedPool) {
      token.loan = tranchedPool.id
      tranchedPool.tokens = tranchedPool.tokens.concat([token.id])
      tranchedPool.save()
    } else if (callableLoan) {
      token.loan = callableLoan.id
      callableLoan.tokens = callableLoan.tokens.concat([token.id])
      callableLoan.save()
    }
    user.poolTokens = user.poolTokens.concat([token.id])
    user.save()
    token.save()
  }
}

export function handleTokenRedeemed(event: TokenRedeemed): void {
  const token = PoolToken.load(event.params.tokenId.toString())
  if (!token) {
    return
  }
  token.interestRedeemable = token.interestRedeemable.minus(event.params.interestRedeemed)
  token.interestRedeemed = token.interestRedeemed.plus(event.params.interestRedeemed)
  token.principalRedeemable = token.principalRedeemable.minus(event.params.principalRedeemed)
  token.principalRedeemed = token.principalRedeemed.plus(event.params.principalRedeemed)
  token.save()
}

function isUserFullyWithdrawnFromPool(user: User, tranchedPool: TranchedPool): boolean {
  for (let i = 0; i < user.poolTokens.length; i++) {
    const token = assert(PoolToken.load(user.poolTokens[i]))
    if (token.loan == tranchedPool.id && !token.principalAmount.isZero()) {
      return false
    }
  }
  return true
}

export function handleTokenPrincipalWithdrawn(event: TokenPrincipalWithdrawn): void {
  const token = PoolToken.load(event.params.tokenId.toString())
  if (!token) {
    return
  }
  token.principalAmount = token.principalAmount.minus(event.params.principalWithdrawn)
  token.principalRedeemable = token.principalRedeemable.minus(event.params.principalWithdrawn)
  token.save()
  if (token.principalAmount.isZero()) {
    const tranchedPool = assert(TranchedPool.load(event.params.pool.toHexString()))
    const user = assert(User.load(event.params.owner.toHexString()))
    if (isUserFullyWithdrawnFromPool(user, tranchedPool)) {
      tranchedPool.backers = removeFromList(tranchedPool.backers, user.id)
      tranchedPool.numBackers = tranchedPool.backers.length
      tranchedPool.save()
    }
  }
}

export function handleTransfer(event: Transfer): void {
  const tokenId = event.params.tokenId.toString()
  const token = PoolToken.load(tokenId)
  if (!token) {
    return
  }
  const oldOwner = getOrInitUser(event.params.from)
  const newOwner = getOrInitUser(event.params.to)
  oldOwner.poolTokens = removeFromList(oldOwner.poolTokens, tokenId)
  oldOwner.save()
  newOwner.poolTokens = newOwner.poolTokens.concat([tokenId])
  newOwner.save()
  token.user = newOwner.id
  token.save()
  deleteZapAfterClaimMaybe(event)
}

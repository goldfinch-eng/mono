import {TokenBurned, TokenMinted, TokenRedeemed, Transfer} from "../../generated/PoolTokens/PoolTokens"
import {TranchedPoolToken} from "../../generated/schema"
import {updatePoolBacker} from "../entities/pool_backer"
import {handleTranchedPoolTokenTransfer, initOrUpdateTranchedPoolToken} from "../entities/pool_tokens"

export function handleTokenBurned(event: TokenBurned): void {
  initOrUpdateTranchedPoolToken(event.params.tokenId)
  updatePoolBacker(event.params.owner, event.params.pool)
}

export function handleTokenMinted(event: TokenMinted): void {
  initOrUpdateTranchedPoolToken(event.params.tokenId)
  updatePoolBacker(event.params.owner, event.params.pool)
  const token = assert(TranchedPoolToken.load(event.params.tokenId.toString()))
  token.mintedAt = event.block.timestamp
  token.save()
}

export function handleTokenRedeemed(event: TokenRedeemed): void {
  initOrUpdateTranchedPoolToken(event.params.tokenId)
  updatePoolBacker(event.params.owner, event.params.pool)
}

export function handleTransfer(event: Transfer): void {
  handleTranchedPoolTokenTransfer(event)
}

import {
  TokenBurned,
  TokenMinted,
  TokenRedeemed,
  Transfer,
} from "../../generated/PoolTokensProxy/PoolTokens"
import { updatePoolBacker } from "../entities/pool_backer"
import { handleTranchedPoolTokenTransfer, initOrUpdateTranchedPoolToken } from "../entities/pool_tokens"


export function handleTokenBurned(event: TokenBurned): void {
  initOrUpdateTranchedPoolToken(event.params.tokenId)
  updatePoolBacker(event.params.owner, event.params.pool)
}

export function handleTokenMinted(event: TokenMinted): void {
  initOrUpdateTranchedPoolToken(event.params.tokenId)
  updatePoolBacker(event.params.owner, event.params.pool)
}

export function handleTokenRedeemed(event: TokenRedeemed): void {
  initOrUpdateTranchedPoolToken(event.params.tokenId)
  updatePoolBacker(event.params.owner, event.params.pool)
}

export function handleTransfer(event: Transfer): void {
  handleTranchedPoolTokenTransfer(event)
}

import {
  TokenBurned,
  TokenMinted,
  TokenRedeemed,
  Transfer,
} from "../../generated/PoolTokensProxy/PoolTokens"
import { updatePoolBacker } from "../entities/pool_backer"
import { getOrInitTranchedPoolToken, handleTranchedPoolTokenTransfer } from "../entities/pool_tokens"


export function handleTokenBurned(event: TokenBurned): void {
  updatePoolBacker(event.params.owner, event.params.tokenId)
}

export function handleTokenMinted(event: TokenMinted): void {
  getOrInitTranchedPoolToken(event.params.tokenId, event.params.owner)
  updatePoolBacker(event.params.owner, event.params.tokenId)
}

export function handleTokenRedeemed(event: TokenRedeemed): void {
  updatePoolBacker(event.params.owner, event.params.tokenId)
}

export function handleTransfer(event: Transfer): void {
  handleTranchedPoolTokenTransfer(event.params.to, event.params.tokenId)
  updatePoolBacker(event.params.from, event.params.tokenId)
  updatePoolBacker(event.params.to, event.params.tokenId)
}

import {
  TokenBurned,
  TokenMinted,
  TokenRedeemed,
  GoldfinchConfigUpdated,
  Transfer,
} from "../../generated/PoolTokensProxy/PoolTokens"


export function handleTokenBurned(event: TokenBurned): void {}

export function handleTokenMinted(event: TokenMinted): void {}

export function handleTokenRedeemed(event: TokenRedeemed): void {}

export function handleGoldfinchConfigUpdated(event: GoldfinchConfigUpdated): void {}

export function handleTransfer(event: Transfer): void {}

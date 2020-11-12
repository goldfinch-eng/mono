## `Fidu`

Fidu (symbol: FIDU) is Goldfinch's liquidity token, representing shares
in the Pool. When you deposit, we mint a corresponding amount of Fidu, and when you withdraw, we
burn Fidu. The share price of the Pool implicitly represents the "exchange rate" between Fidu
and USDC (or whatever currencies the Pool may allow withdraws in during the future)





### `__initialize__(address owner, string name, string symbol, contract GoldfinchConfig _config)` (public)





### `mintTo(address to, uint256 amount)` (public)



Creates `amount` new tokens for `to`.

See {ERC20-_mint}.

Requirements:

- the caller must have the `MINTER_ROLE`.

### `burnFrom(address from, uint256 amount)` (public)



Destroys `amount` tokens from `account`, deducting from the caller's
allowance.

See {ERC20-_burn} and {ERC20-allowance}.

Requirements:

- the caller must have the MINTER_ROLE

### `canMint(uint256 newAmount) → bool` (internal)





### `canBurn(uint256 amountToBurn) → bool` (internal)





### `fiduToUSDC(uint256 amount) → uint256` (internal)





### `fiduMantissa() → uint256` (internal)





### `usdcMantissa() → uint256` (internal)







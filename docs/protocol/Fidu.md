## `Fidu`






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





### `assets() → uint256` (internal)





### `fiduToUSDC(uint256 amount) → uint256` (internal)





### `fiduMantissa() → uint256` (internal)





### `usdcMantissa() → uint256` (internal)







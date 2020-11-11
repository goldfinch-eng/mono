## `Pool`

Main entry point for LP's (a.k.a. capital providers)
Handles key logic for depositing and withdrawing funds from the Pool




### `onlyCreditDesk()`






### `initialize(address owner, contract GoldfinchConfig _config)` (public)

Run only once, on initialization




### `deposit(uint256 amount)` (external)

Deposits `amount` USDC from msg.sender into the Pool, and returns you the equivalent value of FIDU tokens




### `withdraw(uint256 amount)` (external)

Withdraws `amount` USDC from the Pool to msg.sender, and burns the equivalent value of FIDU tokens




### `collectInterestRepayment(address from, uint256 amount)` (external)

Collects `amount` USDC in interest from `from` and sends it to the Pool.
This also increases the share price accordingly. A portion is sent to the Goldfinch Reserve address




### `collectPrincipalRepayment(address from, uint256 amount)` (external)

Collects `amount` USDC in principal from `from` and sends it to the Pool.
The key difference from `collectInterestPayment` is that this does not change the sharePrice.
The reason it does not is because the principal is already baked in. ie. we implicitly assume all principal
will be returned to the Pool. But if borrowers are late with payments, we have a writedown schedule that adjusts
the sharePrice downwards to reflect the lowered confidence in that borrower.




### `distributeLosses(address creditlineAddress, int256 writedownDelta)` (external)





### `transferFrom(address from, address to, uint256 amount) → bool` (public)

Moves `amount` USDC from `from`, to `to`.




### `assets() → uint256` (public)





### `fiduMantissa() → uint256` (internal)





### `usdcMantissa() → uint256` (internal)





### `usdcToFidu(uint256 amount) → uint256` (internal)





### `totalShares() → uint256` (internal)





### `usdcToSharePrice(uint256 usdcAmount) → uint256` (internal)





### `poolWithinLimit(uint256 _totalShares) → bool` (internal)





### `transactionWithinLimit(uint256 amount) → bool` (internal)





### `getNumShares(uint256 amount) → uint256` (internal)





### `assetsMatchLiabilities() → bool` (internal)





### `fiduToUSDC(uint256 amount) → uint256` (internal)





### `sendToReserve(address from, uint256 amount, address userForEvent)` (internal)





### `doUSDCTransfer(address from, address to, uint256 amount) → bool` (internal)






### `DepositMade(address capitalProvider, uint256 amount, uint256 shares)`





### `WithdrawalMade(address capitalProvider, uint256 userAmount, uint256 reserveAmount)`





### `TransferMade(address from, address to, uint256 amount)`





### `InterestCollected(address payer, uint256 poolAmount, uint256 reserveAmount)`





### `PrincipalCollected(address payer, uint256 amount)`





### `ReserveFundsCollected(address user, uint256 amount)`





### `PrincipalWrittendown(address creditline, int256 amount)`






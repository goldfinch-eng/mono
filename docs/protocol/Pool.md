## `Pool`





### `onlyCreditDesk()`






### `initialize(address owner, contract GoldfinchConfig _config)` (public)





### `deposit(uint256 amount)` (external)





### `withdraw(uint256 amount)` (external)





### `collectInterestRepayment(address from, uint256 amount)` (external)





### `collectPrincipalRepayment(address from, uint256 amount)` (external)





### `transferFrom(address from, address to, uint256 amount) → bool` (public)





### `enoughBalance(address user, uint256 amount) → bool` (public)





### `fiduMantissa() → uint256` (internal)





### `usdcMantissa() → uint256` (internal)





### `usdcToFidu(uint256 amount) → uint256` (internal)





### `totalShares() → uint256` (internal)





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






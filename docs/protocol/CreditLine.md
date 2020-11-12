## `CreditLine`

A "dumb" state container that represents the agreement between an Underwriter and
the borrower. Includes the terms of the loan, as well as the current accounting state, such as interest owed.
This contract purposefully has essentially no business logic. Really just setters and getters.




### `onlyAdminOrUnderwriter()`






### `initialize(address owner, address _borrower, address _underwriter, uint256 _limit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr)` (public)





### `setTermEndBlock(uint256 newTermEndBlock)` (external)





### `setNextDueBlock(uint256 newNextDueBlock)` (external)





### `setBalance(uint256 newBalance)` (external)





### `setInterestOwed(uint256 newInterestOwed)` (external)





### `setPrincipalOwed(uint256 newPrincipalOwed)` (external)





### `setInterestAccruedAsOfBlock(uint256 newInterestAccruedAsOfBlock)` (external)





### `setWritedownAmount(uint256 newWritedownAmount)` (external)





### `setLastFullPaymentBlock(uint256 newLastFullPaymentBlock)` (external)





### `setLateFeeApr(uint256 newLateFeeApr)` (external)





### `setLimit(uint256 newAmount)` (external)





### `authorizePool(address configAddress)` (external)







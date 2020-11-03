## `CreditDesk`

Main entry point for borrowers and underwriters.
Handles key logic for creating CreditLine's, borrowing money, repayment, etc.





### `initialize(address owner, contract GoldfinchConfig _config)` (public)





### `setUnderwriterGovernanceLimit(address underwriterAddress, uint256 limit)` (external)

Sets a particular underwriter's limit of how much credit the DAO will allow them to "create"




### `createCreditLine(address _borrower, uint256 _limit, uint256 _interestApr, uint256 _minCollateralPercent, uint256 _paymentPeriodInDays, uint256 _termInDays)` (external)





### `drawdown(uint256 amount, address creditLineAddress, address addressToSendTo)` (external)





### `pay(address creditLineAddress, uint256 amount)` (external)





### `assessCreditLine(address creditLineAddress)` (external)





### `getUnderwriterCreditLines(address underwriterAddress) → address[]` (public)





### `getBorrowerCreditLines(address borrowerAddress) → address[]` (public)





### `collectPayment(contract CreditLine cl, uint256 amount)` (internal)





### `applyPayment(contract CreditLine cl, uint256 amount, uint256 blockNumber)` (internal)





### `handlePayment(contract CreditLine cl, uint256 paymentAmount, uint256 asOfBlock) → uint256, uint256, uint256` (internal)





### `handleLatePayments(contract CreditLine)` (internal)





### `getCreditLineFactory() → contract CreditLineFactory` (internal)





### `subtractClFromTotalLoansOutstanding(contract CreditLine cl)` (internal)





### `addCLToTotalLoansOutstanding(contract CreditLine cl)` (internal)





### `getInterestAndPrincipalOwedAsOf(contract CreditLine cl, uint256 blockNumber) → uint256, uint256` (internal)





### `withinCreditLimit(uint256 amount, contract CreditLine cl) → bool` (internal)





### `withinTransactionLimit(uint256 amount) → bool` (internal)





### `calculateNewTermEndBlock(contract CreditLine cl) → uint256` (internal)





### `calculateNextDueBlock(contract CreditLine cl) → uint256` (internal)





### `underwriterCanCreateThisCreditLine(uint256 newAmount, struct CreditDesk.Underwriter underwriter) → bool` (internal)





### `withinMaxUnderwriterLimit(uint256 amount) → bool` (internal)





### `getCreditCurrentlyExtended(struct CreditDesk.Underwriter underwriter) → uint256` (internal)





### `updateCreditLineAccounting(contract CreditLine cl, uint256 balance, uint256 interestOwed, uint256 principalOwed)` (internal)






### `PaymentApplied(address payer, address creditLine, uint256 interestAmount, uint256 principalAmount, uint256 remainingAmount)`





### `PaymentCollected(address payer, address creditLine, uint256 paymentAmount)`





### `DrawdownMade(address borrower, address creditLine, uint256 drawdownAmount)`





### `CreditLineCreated(address borrower, address creditLine)`





### `GovernanceUpdatedUnderwriterLimit(address underwriter, uint256 newLimit)`






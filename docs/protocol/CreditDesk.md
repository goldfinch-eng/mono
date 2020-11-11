## `CreditDesk`

Main entry point for borrowers and underwriters.
Handles key logic for creating CreditLine's, borrowing money, repayment, etc.





### `initialize(address owner, contract GoldfinchConfig _config)` (public)

Run only once, on initialization




### `setUnderwriterGovernanceLimit(address underwriterAddress, uint256 limit)` (external)

Sets a particular underwriter's limit of how much credit the DAO will allow them to "create"




### `createCreditLine(address _borrower, uint256 _limit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr)` (external)

Allows an underwriter to create a new CreditLine for a single borrower




### `drawdown(uint256 amount, address creditLineAddress, address addressToSendTo)` (external)

Allows a borrower to drawdown on their creditline.
`amount` USDC is sent to the borrower, and the credit line accounting is updated.




### `pay(address creditLineAddress, uint256 amount)` (external)

Allows a borrower to repay their loan. Payment is *collected* immediately (by sending it to
the individual CreditLine), but it is not *applied* unless it is after the nextDueBlock, or until we assess
the credit line (ie. payment period end).
Any amounts over the minimum payment will be applied to outstanding principal (reducing the effective
interest rate). If there is still any left over, it will remain in the USDC Balance
of the CreditLine, which is held distinct from the Pool amounts, and can not be withdrawn by LP's.




### `assessCreditLine(address creditLineAddress)` (public)

Assesses a particular creditLine. This will apply payments, which will update accounting and
distribute gains or losses back to the pool accordingly. This function is idempotent, and anyone
is allowed to call it.




### `getUnderwriterCreditLines(address underwriterAddress) → address[]` (public)

Simple getter for the creditlines of a given underwriter




### `getBorrowerCreditLines(address borrowerAddress) → address[]` (public)

Simple getter for the creditlines of a given borrower




### `collectPayment(contract CreditLine cl, uint256 amount)` (internal)

Collects `amount` of payment for a given credit line. This sends money from the payer to the credit line.
Note that payment is not *applied* when calling this function. Only collected (ie. held) for later application.




### `applyPayment(contract CreditLine cl, uint256 amount, uint256 blockNumber)` (internal)

Applies `amount` of payment for a given credit line. This moves already collected money into the Pool.
It also updates all the accounting variables. Note that interest is always paid back first, then principal.
Any extra after paying the minimum will go towards existing principal (reducing the
effective interest rate). Any extra after the full loan has been paid off will remain in the
USDC Balance of the creditLine, where it will be automatically used for the next drawdown.




### `handlePayment(contract CreditLine cl, uint256 paymentAmount, uint256 asOfBlock) → uint256, uint256, uint256` (internal)





### `updateWritedownAmounts(contract CreditLine cl)` (internal)





### `isLate(contract CreditLine cl) → bool` (internal)





### `getCreditLineFactory() → contract CreditLineFactory` (internal)





### `subtractClFromTotalLoansOutstanding(contract CreditLine cl)` (internal)





### `addCLToTotalLoansOutstanding(contract CreditLine cl)` (internal)





### `updateAndGetInterestAndPrincipalOwedAsOf(contract CreditLine cl, uint256 blockNumber) → uint256, uint256` (internal)





### `withinCreditLimit(uint256 amount, contract CreditLine cl) → bool` (internal)





### `withinTransactionLimit(uint256 amount) → bool` (internal)





### `calculateNewTermEndBlock(contract CreditLine cl) → uint256` (internal)





### `calculateNextDueBlock(contract CreditLine cl) → uint256` (internal)





### `blockNumber() → uint256` (internal)





### `underwriterCanCreateThisCreditLine(uint256 newAmount, struct CreditDesk.Underwriter underwriter) → bool` (internal)





### `withinMaxUnderwriterLimit(uint256 amount) → bool` (internal)





### `getCreditCurrentlyExtended(struct CreditDesk.Underwriter underwriter) → uint256` (internal)





### `updateCreditLineAccounting(contract CreditLine cl, uint256 balance, uint256 interestOwed, uint256 principalOwed)` (internal)





### `getUSDCBalance(address _address) → uint256` (internal)






### `PaymentApplied(address payer, address creditLine, uint256 interestAmount, uint256 principalAmount, uint256 remainingAmount)`





### `PaymentCollected(address payer, address creditLine, uint256 paymentAmount)`





### `DrawdownMade(address borrower, address creditLine, uint256 drawdownAmount)`





### `CreditLineCreated(address borrower, address creditLine)`





### `GovernanceUpdatedUnderwriterLimit(address underwriter, uint256 newLimit)`






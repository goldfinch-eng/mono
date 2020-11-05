## `Accountant`

Library for handling key financial calculations, such as interest and principal accrual.





### `calculateInterestAndPrincipalAccrued(contract CreditLine cl, uint256 blockNumber) → uint256, uint256` (public)





### `calculatePrincipalAccrued(contract CreditLine cl, uint256 blockNumber) → uint256` (public)





### `calculateWritedownFor(contract CreditLine cl, uint256 blockNumber, uint256 gracePeriod, uint256 maxLatePeriods) → uint256, uint256` (public)





### `calculateAmountOwedForOnePeriod(contract CreditLine cl, uint256 asOfBlock) → uint256` (public)





### `calculateInterestAccrued(contract CreditLine cl, uint256 blockNumber) → uint256` (public)





### `allocatePayment(uint256 paymentAmount, uint256 balance, uint256 interestOwed, uint256 principalOwed) → struct Accountant.PaymentAllocation` (public)







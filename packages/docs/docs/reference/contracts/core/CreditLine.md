## CreditLine

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x4Df1e7fFB382F79736CA565F378F783678d995D8

A contract that represents the agreement between Backers and
 a Borrower. Includes the terms of the loan, as well as the current accounting state, such as interest owed.
 A CreditLine belongs to a TranchedPool, and is fully controlled by that TranchedPool. It does not
 operate in any standalone capacity. It should generally be considered internal to the TranchedPool.

### SECONDS_PER_DAY

```solidity
uint256 SECONDS_PER_DAY
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### borrower

```solidity
address borrower
```

### currentLimit

```solidity
uint256 currentLimit
```

### maxLimit

```solidity
uint256 maxLimit
```

### interestApr

```solidity
uint256 interestApr
```

### paymentPeriodInDays

```solidity
uint256 paymentPeriodInDays
```

### termInDays

```solidity
uint256 termInDays
```

### principalGracePeriodInDays

```solidity
uint256 principalGracePeriodInDays
```

### lateFeeApr

```solidity
uint256 lateFeeApr
```

### balance

```solidity
uint256 balance
```

### interestOwed

```solidity
uint256 interestOwed
```

### principalOwed

```solidity
uint256 principalOwed
```

### termEndTime

```solidity
uint256 termEndTime
```

### nextDueTime

```solidity
uint256 nextDueTime
```

### interestAccruedAsOf

```solidity
uint256 interestAccruedAsOf
```

### lastFullPaymentTime

```solidity
uint256 lastFullPaymentTime
```

### totalInterestAccrued

```solidity
uint256 totalInterestAccrued
```

### config

```solidity
contract GoldfinchConfig config
```

### initialize

```solidity
function initialize(address _config, address owner, address _borrower, uint256 _maxLimit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr, uint256 _principalGracePeriodInDays) public
```

### limit

```solidity
function limit() external view returns (uint256)
```

### drawdown

```solidity
function drawdown(uint256 amount) external
```

Updates the internal accounting to track a drawdown as of current block timestamp.
Does not move any money

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount in USDC that has been drawndown |

### setLateFeeApr

```solidity
function setLateFeeApr(uint256 newLateFeeApr) external
```

### setLimit

```solidity
function setLimit(uint256 newAmount) external
```

### setMaxLimit

```solidity
function setMaxLimit(uint256 newAmount) external
```

### termStartTime

```solidity
function termStartTime() external view returns (uint256)
```

### isLate

```solidity
function isLate() external view returns (bool)
```

### withinPrincipalGracePeriod

```solidity
function withinPrincipalGracePeriod() external view returns (bool)
```

### setTermEndTime

```solidity
function setTermEndTime(uint256 newTermEndTime) public
```

### setNextDueTime

```solidity
function setNextDueTime(uint256 newNextDueTime) public
```

### setBalance

```solidity
function setBalance(uint256 newBalance) public
```

### setTotalInterestAccrued

```solidity
function setTotalInterestAccrued(uint256 _totalInterestAccrued) public
```

### setInterestOwed

```solidity
function setInterestOwed(uint256 newInterestOwed) public
```

### setPrincipalOwed

```solidity
function setPrincipalOwed(uint256 newPrincipalOwed) public
```

### setInterestAccruedAsOf

```solidity
function setInterestAccruedAsOf(uint256 newInterestAccruedAsOf) public
```

### setLastFullPaymentTime

```solidity
function setLastFullPaymentTime(uint256 newLastFullPaymentTime) public
```

### assess

```solidity
function assess() public returns (uint256, uint256, uint256)
```

Triggers an assessment of the creditline. Any USDC balance available in the creditline is applied
towards the interest and principal.

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Any amount remaining after applying payments towards the interest and principal |
| [1] | uint256 | Amount applied towards interest |
| [2] | uint256 | Amount applied towards principal |

### calculateNextDueTime

```solidity
function calculateNextDueTime() internal view returns (uint256)
```

### currentTime

```solidity
function currentTime() internal view virtual returns (uint256)
```

### _isLate

```solidity
function _isLate(uint256 timestamp) internal view returns (bool)
```

### _termStartTime

```solidity
function _termStartTime() internal view returns (uint256)
```

### handlePayment

```solidity
function handlePayment(uint256 paymentAmount, uint256 timestamp) internal returns (uint256, uint256, uint256)
```

Applies &#x60;amount&#x60; of payment for a given credit line. This moves already collected money into the Pool.
 It also updates all the accounting variables. Note that interest is always paid back first, then principal.
 Any extra after paying the minimum will go towards existing principal (reducing the
 effective interest rate). Any extra after the full loan has been paid off will remain in the
 USDC Balance of the creditLine, where it will be automatically used for the next drawdown.

| Name | Type | Description |
| ---- | ---- | ----------- |
| paymentAmount | uint256 | The amount, in USDC atomic units, to be applied |
| timestamp | uint256 | The timestamp on which accrual calculations should be based. This allows us  to be precise when we assess a Credit Line |

### _updateAndGetInterestAndPrincipalOwedAsOf

```solidity
function _updateAndGetInterestAndPrincipalOwedAsOf(uint256 timestamp) internal returns (uint256, uint256)
```

### updateCreditLineAccounting

```solidity
function updateCreditLineAccounting(uint256 newBalance, uint256 newInterestOwed, uint256 newPrincipalOwed) internal
```

### _getUSDCBalance

```solidity
function _getUSDCBalance(address _address) internal view returns (uint256)
```


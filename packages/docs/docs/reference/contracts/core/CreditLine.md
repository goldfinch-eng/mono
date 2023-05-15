## CreditLine

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x86db002dbBb64D67ef4B43C76C432BF5BCBF7197

A contract that represents the agreement between Backers and
 a Borrower. Includes the terms of the loan, as well as the accounting state such as interest owed.
 A CreditLine instance belongs to a TranchedPool instance and is fully controlled by that TranchedPool
 instance. It should not operate in any standalone capacity and should generally be considered internal
 to the TranchedPool instance.

### INTEREST_DECIMALS

```solidity
uint256 INTEREST_DECIMALS
```

### SECONDS_PER_DAY

```solidity
uint256 SECONDS_PER_DAY
```

### SECONDS_PER_YEAR

```solidity
uint256 SECONDS_PER_YEAR
```

### config

```solidity
contract GoldfinchConfig config
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

### lateFeeApr

```solidity
uint256 lateFeeApr
```

### balance

```solidity
uint256 balance
```

### totalInterestPaid

```solidity
uint256 totalInterestPaid
```

Cumulative interest paid back up to now

### lastFullPaymentTime

```solidity
uint256 lastFullPaymentTime
```

### _totalInterestAccrued

```solidity
uint256 _totalInterestAccrued
```

### _totalInterestOwed

```solidity
uint256 _totalInterestOwed
```

### _checkpointedAsOf

```solidity
uint256 _checkpointedAsOf
```

### schedule

```solidity
struct PaymentSchedule schedule
```

### initialize

```solidity
function initialize(address _config, address owner, address _borrower, uint256 _maxLimit, uint256 _interestApr, contract ISchedule _schedule, uint256 _lateFeeApr) public
```

Initialize a brand new credit line

### pay

```solidity
function pay(uint256 paymentAmount) external returns (struct ILoan.PaymentAllocation)
```

Process a bulk payment, allocating the payment amount based on the payment waterfall

### pay

```solidity
function pay(uint256 principalPayment, uint256 interestPayment) public returns (struct ILoan.PaymentAllocation)
```

Process a payment according to the waterfall described in `Accountant.allocatePayment`

_II: insufficient interest_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| principalPayment | uint256 | principal payment amount |
| interestPayment | uint256 | interest payment amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ILoan.PaymentAllocation | payment allocation |

### drawdown

```solidity
function drawdown(uint256 amount) external
```

Drawdown on the line

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | amount to drawdown. Cannot exceed the line's limit |

### setLimit

```solidity
function setLimit(uint256 newAmount) external
```

### setMaxLimit

```solidity
function setMaxLimit(uint256 newAmount) external
```

### interestAccruedAsOf

```solidity
function interestAccruedAsOf() public view virtual returns (uint256)
```

We keep this to conform to the ICreditLine interface, but it's redundant information
  now that we have `checkpointedAsOf`

### isLate

```solidity
function isLate() external view returns (bool)
```

### withinPrincipalGracePeriod

```solidity
function withinPrincipalGracePeriod() public view returns (bool)
```

### interestOwed

```solidity
function interestOwed() public view virtual returns (uint256)
```

### interestOwedAt

```solidity
function interestOwedAt(uint256 timestamp) public view returns (uint256)
```

Interest that would be owed at `timestamp`

### totalInterestAccrued

```solidity
function totalInterestAccrued() public view returns (uint256)
```

Cumulative interest accrued up to now

### totalInterestAccruedAt

```solidity
function totalInterestAccruedAt(uint256 timestamp) public view returns (uint256)
```

Cumulative interest accrued up to `timestamp`

### totalInterestOwedAt

```solidity
function totalInterestOwedAt(uint256 timestamp) public view returns (uint256)
```

Cumulative interest owed up to `timestamp`

### limit

```solidity
function limit() public view returns (uint256)
```

### totalPrincipalPaid

```solidity
function totalPrincipalPaid() public view returns (uint256)
```

Returns the total amount of principal thats been paid

### totalInterestOwed

```solidity
function totalInterestOwed() public view returns (uint256)
```

Cumulative interest owed up to now

### interestAccrued

```solidity
function interestAccrued() public view returns (uint256)
```

Interest accrued in the current payment period up to now. Converted to
  owed interest once we cross into the next payment period. Is 0 if the
  current time is after loan maturity (all interest accrued immediately becomes
  interest owed).

### principalOwedAt

```solidity
function principalOwedAt(uint256 timestamp) public view returns (uint256)
```

Principal owed up to `timestamp`

### totalPrincipalOwedAt

```solidity
function totalPrincipalOwedAt(uint256 timestamp) public view returns (uint256)
```

Cumulative principal owed at timestamp

### principalOwed

```solidity
function principalOwed() public view returns (uint256)
```

### interestAccruedAt

```solidity
function interestAccruedAt(uint256 timestamp) public view returns (uint256)
```

Interest accrued in the current payment period for `timestamp`. Coverted to
  owed interest once we cross into the payment period after `timestamp`. Is 0
  if `timestamp` is after loan maturity (all interest accrued immediately becomes
  interest owed).

### nextDueTime

```solidity
function nextDueTime() external view returns (uint256)
```

### nextDueTimeAt

```solidity
function nextDueTimeAt(uint256 timestamp) external view returns (uint256)
```

### termStartTime

```solidity
function termStartTime() public view returns (uint256)
```

Time of first drawdown

### termEndTime

```solidity
function termEndTime() public view returns (uint256)
```

### totalPrincipalOwed

```solidity
function totalPrincipalOwed() public view returns (uint256)
```

Cumulative principal owed at current timestamp

### _checkpoint

```solidity
function _checkpoint() internal
```

Updates accounting variables. This should be called before any changes to `balance`!

### _interestAccruedOverPeriod

```solidity
function _interestAccruedOverPeriod(uint256 start, uint256 end) internal view returns (uint256)
```

### _lateFeesAccuredOverPeriod

```solidity
function _lateFeesAccuredOverPeriod(uint256 start, uint256 end) internal view returns (uint256)
```

### _isLate

```solidity
function _isLate(uint256 timestamp) internal view returns (bool)
```

## PaymentSchedule

```solidity
struct PaymentSchedule {
  contract ISchedule schedule;
  uint64 startTime;
}
```

## PaymentScheduleLib

### startAt

```solidity
function startAt(struct PaymentSchedule s, uint256 timestamp) internal
```

### previousDueTimeAt

```solidity
function previousDueTimeAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### previousInterestDueTimeAt

```solidity
function previousInterestDueTimeAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### principalPeriodAt

```solidity
function principalPeriodAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### totalPrincipalPeriods

```solidity
function totalPrincipalPeriods(struct PaymentSchedule s) internal view returns (uint256)
```

### isActive

```solidity
function isActive(struct PaymentSchedule s) internal view returns (bool)
```

### termEndTime

```solidity
function termEndTime(struct PaymentSchedule s) internal view returns (uint256)
```

### termStartTime

```solidity
function termStartTime(struct PaymentSchedule s) internal view returns (uint256)
```

### nextDueTimeAt

```solidity
function nextDueTimeAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### withinPrincipalGracePeriodAt

```solidity
function withinPrincipalGracePeriodAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (bool)
```

### isActiveMod

```solidity
modifier isActiveMod(struct PaymentSchedule s)
```


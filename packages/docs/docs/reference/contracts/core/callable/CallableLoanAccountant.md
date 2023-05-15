## CallableLoanAccountant

Library for handling allocations of payments and interest calculations
        for callable loans.

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

### allocatePayment

```solidity
function allocatePayment(uint256 paymentAmount, uint256 interestOwed, uint256 interestAccrued, uint256 principalOwed, uint256 interestRate, uint256 timeUntilNextPrincipalSettlement, uint256 balance, uint256 guaranteedFutureInterestPaid) internal pure returns (struct ILoan.PaymentAllocation)
```

Allocate a payment to proper balances according to the payment waterfall.
        Expected payment waterfall:
        1. Interest owed
        2. Principal owed
        3. Interest accrued
        4. Interest guaranteed to accrue before the next principal settlement
        5. Any additional remaining balance

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| paymentAmount | uint256 | amount to allocate |
| interestOwed | uint256 | interest owed on the credit line up to the last due time |
| interestAccrued | uint256 | interest accrued between the last due time and the present time |
| principalOwed | uint256 | principal owed on the credit line |
| interestRate | uint256 | interest which is guaranteed to accrue between now and                      the next time principal is settled |
| timeUntilNextPrincipalSettlement | uint256 | time at which the next principal payment is due |
| balance | uint256 | Balance = Remaining principal outstanding |
| guaranteedFutureInterestPaid | uint256 | guaranteed future interest which has already been paid |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ILoan.PaymentAllocation | PaymentAllocation payment allocation |

### calculateInterest

```solidity
function calculateInterest(uint256 secondsElapsed, uint256 principal, uint256 interestApr) internal pure returns (uint256)
```

Calculates flat interest accrued over a period of time given constant principal.

### calculateInterest

```solidity
function calculateInterest(uint256 start, uint256 end, uint256 lateFeesStartsAt, uint256 lateFeesEndAt, uint256 principal, uint256 interestApr, uint256 lateInterestAdditionalApr) internal pure returns (uint256 interest)
```

Calculates interest accrued along with late interest over a given time period given constant principal


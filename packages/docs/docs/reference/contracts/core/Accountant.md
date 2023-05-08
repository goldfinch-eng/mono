## Accountant

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x6CE93728877396D43874eFdd6345E8c251dFE008

Library for handling key financial calculations, such as interest and principal accrual.

### FP_SCALING_FACTOR

```solidity
uint256 FP_SCALING_FACTOR
```

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

### AllocatePaymentParams

```solidity
struct AllocatePaymentParams {
  uint256 principalPayment;
  uint256 interestPayment;
  uint256 balance;
  uint256 interestOwed;
  uint256 interestAccrued;
  uint256 principalOwed;
}
```

### calculateWritedownFor

```solidity
function calculateWritedownFor(contract ICreditLine cl, uint256 timestamp, uint256 gracePeriodInDays, uint256 maxDaysLate) public view returns (uint256, uint256)
```

### calculateWritedownForPrincipal

```solidity
function calculateWritedownForPrincipal(contract ICreditLine cl, uint256 principal, uint256 timestamp, uint256 gracePeriodInDays, uint256 maxDaysLate) public view returns (uint256, uint256)
```

### calculateAmountOwedForOneDay

```solidity
function calculateAmountOwedForOneDay(contract ICreditLine cl) public view returns (struct FixedPoint.Unsigned)
```

### splitPayment

```solidity
function splitPayment(uint256 paymentAmount, uint256 balance, uint256 interestOwed, uint256 interestAccrued, uint256 principalOwed) external pure returns (uint256 interestPayment, uint256 principalPayment)
```

Given a lump sum, returns the amount of the payment that should be allocated
        to paying interest, and the amount that should be allocated to paying principal

### allocatePayment

```solidity
function allocatePayment(struct Accountant.AllocatePaymentParams params) public pure returns (struct ILoan.PaymentAllocation)
```

Allocate a payment.
 1. interestOwed must be paid before principalOwed
 2. principalOwed must be paid before interestAccrued
 3. interestAccrued must be paid before the rest of the balance

_IO - Interest Owed
PO - Principal Owed
AI - Accrued Interest_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct Accountant.AllocatePaymentParams | specifying payment amounts and amounts owed |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ILoan.PaymentAllocation | payment allocation |


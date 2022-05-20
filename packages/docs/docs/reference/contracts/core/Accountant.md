## Accountant

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xCb4c20Da8BB0D8496708eDB919e0db925E1C2D93

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

### PaymentAllocation

```solidity
struct PaymentAllocation {
  uint256 interestPayment;
  uint256 principalPayment;
  uint256 additionalBalancePayment;
}
```

### calculateInterestAndPrincipalAccrued

```solidity
function calculateInterestAndPrincipalAccrued(contract CreditLine cl, uint256 timestamp, uint256 lateFeeGracePeriod) public view returns (uint256, uint256)
```

### calculateInterestAndPrincipalAccruedOverPeriod

```solidity
function calculateInterestAndPrincipalAccruedOverPeriod(contract CreditLine cl, uint256 balance, uint256 startTime, uint256 endTime, uint256 lateFeeGracePeriod) public view returns (uint256, uint256)
```

### calculatePrincipalAccrued

```solidity
function calculatePrincipalAccrued(contract ICreditLine cl, uint256 balance, uint256 timestamp) public view returns (uint256)
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
function calculateAmountOwedForOneDay(contract ICreditLine cl) public view returns (struct FixedPoint.Unsigned interestOwed)
```

### calculateInterestAccrued

```solidity
function calculateInterestAccrued(contract CreditLine cl, uint256 balance, uint256 timestamp, uint256 lateFeeGracePeriodInDays) public view returns (uint256)
```

### calculateInterestAccruedOverPeriod

```solidity
function calculateInterestAccruedOverPeriod(contract CreditLine cl, uint256 balance, uint256 startTime, uint256 endTime, uint256 lateFeeGracePeriodInDays) public view returns (uint256 interestOwed)
```

### lateFeeApplicable

```solidity
function lateFeeApplicable(contract CreditLine cl, uint256 timestamp, uint256 gracePeriodInDays) public view returns (bool)
```

### allocatePayment

```solidity
function allocatePayment(uint256 paymentAmount, uint256 balance, uint256 interestOwed, uint256 principalOwed) public pure returns (struct Accountant.PaymentAllocation)
```


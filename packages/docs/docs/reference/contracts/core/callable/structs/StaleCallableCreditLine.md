## StaleCallableCreditLine

```solidity
struct StaleCallableCreditLine {
  struct CallableCreditLine _cl;
}
```

## StaleCallableCreditLineLogic

Simple wrapper around CallableCreditLine which returns a checkpointed
CallableCreditLine after checkpoint() is called.

### initialize

```solidity
function initialize(struct StaleCallableCreditLine cl, contract IGoldfinchConfig _config, uint256 _fundableAt, uint256 _numLockupPeriods, contract ISchedule _schedule, uint256 _interestApr, uint256 _lateAdditionalApr, uint256 _limit) internal
```

### checkpoint

```solidity
function checkpoint(struct StaleCallableCreditLine cl) internal returns (struct CallableCreditLine)
```

### schedule

```solidity
function schedule(struct StaleCallableCreditLine cl) internal view returns (contract ISchedule)
```

### termStartTime

```solidity
function termStartTime(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### lastFullPaymentTime

```solidity
function lastFullPaymentTime(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### fundableAt

```solidity
function fundableAt(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### limit

```solidity
function limit(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### interestApr

```solidity
function interestApr(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### lateAdditionalApr

```solidity
function lateAdditionalApr(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### isLate

```solidity
function isLate(struct StaleCallableCreditLine cl) internal view returns (bool)
```

### loanPhase

```solidity
function loanPhase(struct StaleCallableCreditLine cl) internal view returns (enum LoanPhase)
```

### checkpointedAsOf

```solidity
function checkpointedAsOf(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### numLockupPeriods

```solidity
function numLockupPeriods(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### inLockupPeriod

```solidity
function inLockupPeriod(struct StaleCallableCreditLine cl) internal view returns (bool)
```

### interestOwed

```solidity
function interestOwed(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### principalOwed

```solidity
function principalOwed(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### interestOwedAt

```solidity
function interestOwedAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### principalOwedAt

```solidity
function principalOwedAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### totalInterestOwedAt

```solidity
function totalInterestOwedAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### totalPrincipalOwedAt

```solidity
function totalPrincipalOwedAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### totalInterestOwed

```solidity
function totalInterestOwed(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### totalPrincipalDeposited

```solidity
function totalPrincipalDeposited(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### totalPrincipalOwed

```solidity
function totalPrincipalOwed(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### totalPrincipalOutstanding

```solidity
function totalPrincipalOutstanding(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### nextInterestDueTimeAt

```solidity
function nextInterestDueTimeAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### nextPrincipalDueTime

```solidity
function nextPrincipalDueTime(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### nextDueTimeAt

```solidity
function nextDueTimeAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### nextDueTime

```solidity
function nextDueTime(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### termEndTime

```solidity
function termEndTime(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### proportionalCallablePrincipal

```solidity
function proportionalCallablePrincipal(struct StaleCallableCreditLine cl, uint256 trancheId, uint256 principalDeposited) internal view returns (uint256)
```

### proportionalInterestAndPrincipalAvailable

```solidity
function proportionalInterestAndPrincipalAvailable(struct StaleCallableCreditLine cl, uint256 trancheId, uint256 principal, uint256 feePercent) internal view returns (uint256, uint256)
```

### totalInterestAccrued

```solidity
function totalInterestAccrued(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### totalInterestAccruedAt

```solidity
function totalInterestAccruedAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### interestAccrued

```solidity
function interestAccrued(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### interestAccruedAt

```solidity
function interestAccruedAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

If a checkpoint has not occurred, late fees may be overestimated beyond the next due time.

### totalInterestPaid

```solidity
function totalInterestPaid(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### totalPrincipalPaidAt

```solidity
function totalPrincipalPaidAt(struct StaleCallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### totalPrincipalPaid

```solidity
function totalPrincipalPaid(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### withinPrincipalGracePeriod

```solidity
function withinPrincipalGracePeriod(struct StaleCallableCreditLine cl) internal view returns (bool)
```

### uncalledCapitalTrancheIndex

```solidity
function uncalledCapitalTrancheIndex(struct StaleCallableCreditLine cl) internal view returns (uint256)
```

### getSettledTrancheInfo

```solidity
function getSettledTrancheInfo(struct StaleCallableCreditLine cl, uint256 trancheId) internal view returns (struct SettledTrancheInfo)
```


## CallableCreditLine

```solidity
struct CallableCreditLine {
  contract IGoldfinchConfig _config;
  uint256 _fundableAt;
  uint256 _limit;
  uint256 _interestApr;
  uint256 _lateAdditionalApr;
  uint256 _numLockupPeriods;
  uint256 _checkpointedAsOf;
  uint256 _lastFullPaymentTime;
  uint256 _totalInterestOwedAtLastCheckpoint;
  uint256 _totalInterestAccruedAtLastCheckpoint;
  struct Waterfall _waterfall;
  struct PaymentSchedule _paymentSchedule;
  uint256[20] __padding;
}
```

## SettledTrancheInfo

```solidity
struct SettledTrancheInfo {
  uint256 principalDeposited;
  uint256 principalPaid;
  uint256 principalReserved;
  uint256 interestPaid;
}
```

## CallableCreditLineLogic

### SECONDS_PER_DAY

```solidity
uint256 SECONDS_PER_DAY
```

### initialize

```solidity
function initialize(struct CallableCreditLine cl, contract IGoldfinchConfig _config, uint256 _fundableAt, uint256 _numLockupPeriods, contract ISchedule _schedule, uint256 _interestApr, uint256 _lateAdditionalApr, uint256 _limit) internal
```

### pay

```solidity
function pay(struct CallableCreditLine cl, uint256 principalPayment, uint256 interestPayment) internal
```

### drawdown

```solidity
function drawdown(struct CallableCreditLine cl, uint256 amount) internal
```

Updates accounting for the given drawdown amount.
        If the loan is in the Funding state, then the loan will be permanently
        transitioned to the DrawdownPeriod state.

### submitCall

```solidity
function submitCall(struct CallableCreditLine cl, uint256 amount) internal returns (uint256 principalDepositedMoved, uint256 principalPaidMoved, uint256 principalReservedMoved, uint256 interestMoved)
```

### deposit

```solidity
function deposit(struct CallableCreditLine cl, uint256 amount) internal
```

### withdraw

```solidity
function withdraw(struct CallableCreditLine cl, uint256 amount) internal
```

Withdraws funds from the specified tranche.

### checkpoint

```solidity
function checkpoint(struct CallableCreditLine cl) internal
```

Settles payment reserves and updates the checkpointed values.

### setFundableAt

```solidity
function setFundableAt(struct CallableCreditLine cl, uint256 newFundableAt) internal
```

### loanPhase

```solidity
function loanPhase(struct CallableCreditLine cl) internal view returns (enum LoanPhase)
```

### numLockupPeriods

```solidity
function numLockupPeriods(struct CallableCreditLine cl) internal view returns (uint256)
```

### uncalledCapitalTrancheIndex

```solidity
function uncalledCapitalTrancheIndex(struct CallableCreditLine cl) internal view returns (uint256)
```

### principalOwedAt

```solidity
function principalOwedAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256 returnedPrincipalOwed)
```

### principalOwed

```solidity
function principalOwed(struct CallableCreditLine cl) internal view returns (uint256)
```

### totalPrincipalOwed

```solidity
function totalPrincipalOwed(struct CallableCreditLine cl) internal view returns (uint256)
```

### totalPrincipalOwedAt

```solidity
function totalPrincipalOwedAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### totalPrincipalPaid

```solidity
function totalPrincipalPaid(struct CallableCreditLine cl) internal view returns (uint256)
```

### totalInterestOwedAt

```solidity
function totalInterestOwedAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

Calculates total interest owed at a given timestamp.
IT: Invalid timestamp - timestamp must be after the last checkpoint.

### interestOwedAt

```solidity
function interestOwedAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

Calculates total interest owed at a given timestamp.
Assumes that principal outstanding is constant from now until the given `timestamp`.
IT: Invalid timestamp

### interestAccruedAt

```solidity
function interestAccruedAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

Interest accrued up to `timestamp`
PT: Past timestamp - timestamp must be now or in the future.

### totalInterestAccruedAt

```solidity
function totalInterestAccruedAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256 totalInterestAccruedReturned)
```

Calculates interest accrued over the duration bounded by the `cl._checkpointedAsOf` and `timestamp` timestamps.
Assumes cl._waterfall.totalPrincipalOutstanding() for the principal balance that the interest is applied to.
Assumes a checkpoint has occurred.
If a checkpoint has not occurred, late fees will not account for balance settlement or future payments.
Late fees should be applied to interest accrued up until block.timestamp.
Should not account for late fees in interest which will accrue in the future as payments could occur.

### totalPrincipalPaidAt

```solidity
function totalPrincipalPaidAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256 principalPaidSum)
```

### lastFullPaymentTime

```solidity
function lastFullPaymentTime(struct CallableCreditLine cl) internal view returns (uint256 fullPaymentTime)
```

### isLate

```solidity
function isLate(struct CallableCreditLine cl) internal view returns (bool)
```

### isLate

```solidity
function isLate(struct CallableCreditLine cl, uint256 timestamp) internal view returns (bool)
```

### totalPrincipalOutstanding

```solidity
function totalPrincipalOutstanding(struct CallableCreditLine cl) internal view returns (uint256)
```

Returns the total amount of principal outstanding - after applying reserved principal.

### trancheIndexAtTimestamp

```solidity
function trancheIndexAtTimestamp(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

Returns the tranche index which the given timestamp falls within.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The tranche index will go 1 beyond the max tranche index to represent the "after loan" period.         This is not to be confused with activeCallSubmissionTrancheIndex, which is the tranche for which         current call requests should be submitted to.         See notes.md for explanation of relationship between principalPeriod, call request period and tranche. |

### activeCallSubmissionTrancheIndex

```solidity
function activeCallSubmissionTrancheIndex(struct CallableCreditLine cl) internal view returns (uint256 activeTrancheIndex)
```

Returns the index of the tranche which current call requests should be submitted to.
See notes.md for explanation of relationship between principalPeriod, call request period and tranche.

### getSettledTrancheInfo

```solidity
function getSettledTrancheInfo(struct CallableCreditLine cl, uint256 trancheId) internal view returns (struct SettledTrancheInfo settledTrancheInfo)
```

Returns the balances of the given tranche - only settling principal if the tranche should be settled.

### totalInterestPaid

```solidity
function totalInterestPaid(struct CallableCreditLine cl) internal view returns (uint256)
```

### totalPrincipalDeposited

```solidity
function totalPrincipalDeposited(struct CallableCreditLine cl) internal view returns (uint256)
```

### inLockupPeriod

```solidity
function inLockupPeriod(struct CallableCreditLine cl) internal view returns (bool)
```

### isActive

```solidity
function isActive(struct CallableCreditLine cl) internal view returns (bool)
```

### withinPrincipalGracePeriod

```solidity
function withinPrincipalGracePeriod(struct CallableCreditLine cl) internal view returns (bool)
```

### nextPrincipalDueTime

```solidity
function nextPrincipalDueTime(struct CallableCreditLine cl) internal view returns (uint256)
```

### nextPrincipalDueTimeAt

```solidity
function nextPrincipalDueTimeAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### nextInterestDueTimeAt

```solidity
function nextInterestDueTimeAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### nextDueTime

```solidity
function nextDueTime(struct CallableCreditLine cl) internal view returns (uint256)
```

### nextDueTimeAt

```solidity
function nextDueTimeAt(struct CallableCreditLine cl, uint256 timestamp) internal view returns (uint256)
```

### termStartTime

```solidity
function termStartTime(struct CallableCreditLine cl) internal view returns (uint256)
```

### termEndTime

```solidity
function termEndTime(struct CallableCreditLine cl) internal view returns (uint256)
```

### fundableAt

```solidity
function fundableAt(struct CallableCreditLine cl) internal view returns (uint256)
```

### interestApr

```solidity
function interestApr(struct CallableCreditLine cl) internal view returns (uint256)
```

### lateAdditionalApr

```solidity
function lateAdditionalApr(struct CallableCreditLine cl) internal view returns (uint256)
```

### limit

```solidity
function limit(struct CallableCreditLine cl) internal view returns (uint256)
```

### checkpointedAsOf

```solidity
function checkpointedAsOf(struct CallableCreditLine cl) internal view returns (uint256)
```

### DepositsLocked

```solidity
event DepositsLocked(address loan)
```

## PreviewCallableCreditLineLogic

Functions which make no assumption that a checkpoint has just occurred.

### previewProportionalInterestAndPrincipalAvailable

```solidity
function previewProportionalInterestAndPrincipalAvailable(struct CallableCreditLine cl, uint256 trancheId, uint256 principal, uint256 feePercent) internal view returns (uint256, uint256)
```

### previewProportionalCallablePrincipal

```solidity
function previewProportionalCallablePrincipal(struct CallableCreditLine cl, uint256 trancheId, uint256 principalDeposited) internal view returns (uint256)
```

### previewInterestOwed

```solidity
function previewInterestOwed(struct CallableCreditLine cl) internal view returns (uint256)
```

Returns the total interest owed less total interest paid

### previewTotalInterestOwed

```solidity
function previewTotalInterestOwed(struct CallableCreditLine cl) internal view returns (uint256)
```

Returns the total interest owed

### previewInterestAccrued

```solidity
function previewInterestAccrued(struct CallableCreditLine cl) internal view returns (uint256)
```

Interest accrued up to now minus the max(totalInterestPaid, totalInterestOwedAt)

### previewTotalInterestAccrued

```solidity
function previewTotalInterestAccrued(struct CallableCreditLine cl) internal view returns (uint256)
```

Returns the total interest accrued

## CheckpointedCallableCreditLineLogic

Functions which assume a checkpoint has just occurred.

### totalInterestOwed

```solidity
function totalInterestOwed(struct CallableCreditLine cl) internal view returns (uint256)
```

### totalInterestAccrued

```solidity
function totalInterestAccrued(struct CallableCreditLine cl) internal view returns (uint256)
```

### proportionalCallablePrincipal

```solidity
function proportionalCallablePrincipal(struct CallableCreditLine cl, uint256 trancheId, uint256 principalDeposited) internal view returns (uint256)
```

### proportionalInterestAndPrincipalAvailable

```solidity
function proportionalInterestAndPrincipalAvailable(struct CallableCreditLine cl, uint256 trancheId, uint256 principal, uint256 feePercent) internal view returns (uint256, uint256)
```

### interestOwed

```solidity
function interestOwed(struct CallableCreditLine cl) internal view returns (uint256)
```

Returns the total interest owed less total interest paid

### interestAccrued

```solidity
function interestAccrued(struct CallableCreditLine cl) internal view returns (uint256)
```

Interest accrued up to now minus the max(totalInterestPaid, totalInterestOwedAt)


## PaymentSchedule

```solidity
struct PaymentSchedule {
  contract ISchedule schedule;
  uint64 startTime;
}
```

## PaymentScheduleLogic

### startAt

```solidity
function startAt(struct PaymentSchedule s, uint256 timestamp) internal
```

### previousInterestDueTimeAt

```solidity
function previousInterestDueTimeAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### nextInterestDueTimeAt

```solidity
function nextInterestDueTimeAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### nextPrincipalDueTimeAt

```solidity
function nextPrincipalDueTimeAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### principalPeriodAt

```solidity
function principalPeriodAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
```

### currentPrincipalPeriod

```solidity
function currentPrincipalPeriod(struct PaymentSchedule s) internal view returns (uint256)
```

### currentPeriod

```solidity
function currentPeriod(struct PaymentSchedule s) internal view returns (uint256)
```

### periodEndTime

```solidity
function periodEndTime(struct PaymentSchedule s, uint256 period) internal view returns (uint256)
```

### periodAt

```solidity
function periodAt(struct PaymentSchedule s, uint256 timestamp) internal view returns (uint256)
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

### periodsPerPrincipalPeriod

```solidity
function periodsPerPrincipalPeriod(struct PaymentSchedule s) internal view returns (uint256)
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


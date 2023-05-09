## MonthlyPeriodMapper

A schedule mapping timestamps to periods. Each period begins on the first second
        of each month

### periodOf

```solidity
function periodOf(uint256 timestamp) external pure returns (uint256)
```

Returns the period that a timestamp resides in

### startOf

```solidity
function startOf(uint256 period) external pure returns (uint256)
```

Returns the starting timestamp of a given period


## MonthlyScheduleRepo

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xb7BEE8985cf7c1dbb35425c804199a51A5aBE9c5

Repository for re-usable schedules that function on calendar month periods.
In general periods can be any length, but Warbler maintains a repository of schedules
with monthly periods because that's the most common type of schedule used on the
Goldfinch protocol.

### periodMapper

```solidity
contract IPeriodMapper periodMapper
```

### schedules

```solidity
mapping(bytes32 => address) schedules
```

### constructor

```solidity
constructor() public
```

### getSchedule

```solidity
function getSchedule(uint256 periodsInTerm, uint256 periodsPerPrincipalPeriod, uint256 periodsPerInterestPeriod, uint256 gracePrincipalPeriods) external view returns (contract ISchedule)
```

Get the schedule with the requested params. Reverts if the
schedule is not in the repo - see _createSchedule_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract ISchedule | schedule the schedule |

### createSchedule

```solidity
function createSchedule(uint256 periodsInTerm, uint256 periodsPerPrincipalPeriod, uint256 periodsPerInterestPeriod, uint256 gracePrincipalPeriods) external returns (contract ISchedule)
```

Add a schedule with the provided params to the repo

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract ISchedule | schedule the schedule |

### getScheduleId

```solidity
function getScheduleId(uint256 periodsInTerm, uint256 periodsPerPrincipalPeriod, uint256 periodsPerInterestPeriod, uint256 gracePrincipalPeriods) private pure returns (bytes32)
```


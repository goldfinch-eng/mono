## Schedule

A contract meant to be re-used between tranched pools to determine when payments are due
        using some period mapper contract that maps timestamps to real world concepts of time (months).
        This contract allows a user to specify how often interest payments and principal payments should come
        due by allowing the creator to specify the length of of interest periods and principal periods. Additionally
        the creator can specify how many of the principal periods are considered "grace periods"

Example:
Here's a visualization of a schedule with the following parameters
periodMapper = monthly periods
periodsInTerm = 12 (1 year)
periodsPerInterestPeriod = 3 (quarterly)
periodsPerPrincipalPeriod = 6 (halfly)
gracePrincipalPeriods = 1

                      +- Stub Period     +- Principal Grace Period
 grace periods        v                  v
                    +---+-----------------------+-----------------------+
 principal periods  |///|=======================|           0           |
                    |///+-----------+-----------+-----------+-----------+ E
 interest periods   |///|     0     |     1     |     2     |     3     | N
                    +---+---+---+---+---+---+---+---+---+---+---+---+---+ D
 periods            |FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JAN|FEB|
                    |   | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10| 11|
                 ---+---+---+---+---+---+---+---+---+---+---+---+---+---+---
 absolute        ...| 25| 26| 27| 28| 29| 30| 31| 32| 33| 34| 35| 36| 37|...
 periods            |   |   |   |   |   |   |   |   |   |   |   |   |   |
                 ---+---+---+---+---+---+---+---+---+---+---+---+---+---+---
                     ^
                     +- start time
When a borrower draws down, a "stub period" is created. This period is the remainder of the
period they drew down in, but at the end of this period no payment of any kind should be due.
We treat this stub period as an extension to period 0.

At the end of each interest or principal period a payment is expected. For example
imagine today is Oct 10th. Your next interest payment will be the beginning of December
because the current interest period, period 2, ends in december. Your next principal payment
will be due at the end of February because the current principal period, period 0, ends in
February. This is also the end of the loan, and so all interest and principal should be due
at this time.

_Because this contract is meant to be re-used between contracts, the "start time" is not stored on this contract
     Instead, it's passed in to each function call._

### periodMapper

```solidity
contract IPeriodMapper periodMapper
```

the payment date schedule

### periodsInTerm

```solidity
uint256 periodsInTerm
```

the number of periods in the term of the loan

### periodsPerInterestPeriod

```solidity
uint256 periodsPerInterestPeriod
```

the number of payment periods that need to pass before interest
        comes due

### periodsPerPrincipalPeriod

```solidity
uint256 periodsPerPrincipalPeriod
```

the number of payment periods that need to pass before principal
        comes due

### gracePrincipalPeriods

```solidity
uint256 gracePrincipalPeriods
```

the number of principal periods where no principal will be due

### constructor

```solidity
constructor(contract IPeriodMapper _periodMapper, uint256 _periodsInTerm, uint256 _periodsPerPrincipalPeriod, uint256 _periodsPerInterestPeriod, uint256 _gracePrincipalPeriods) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _periodMapper | contract IPeriodMapper | contract that maps timestamps to periods |
| _periodsInTerm | uint256 | the number of periods in the term of the loan |
| _periodsPerPrincipalPeriod | uint256 | the number of payment periods that need to pass before principal         comes due |
| _periodsPerInterestPeriod | uint256 | the number of payment periods that need to pass before interest         comes due. |
| _gracePrincipalPeriods | uint256 | principal periods where principal will not be due |

### interestPeriodAt

```solidity
function interestPeriodAt(uint256 startTime, uint256 timestamp) public view returns (uint256)
```

Returns the interest period that timestamp resides in

### periodAt

```solidity
function periodAt(uint256 startTime, uint256 timestamp) public view returns (uint256)
```

Returns the period that timestamp resides in

### principalPeriodAt

```solidity
function principalPeriodAt(uint256 startTime, uint256 timestamp) public view returns (uint256)
```

Returns the principal period that timestamp resides in

### withinPrincipalGracePeriodAt

```solidity
function withinPrincipalGracePeriodAt(uint256 startTime, uint256 timestamp) public view returns (bool)
```

Returns true if the given timestamp resides in a principal grace period

### nextDueTimeAt

```solidity
function nextDueTimeAt(uint256 startTime, uint256 timestamp) external view returns (uint256)
```

Returns the next timestamp where either principal or interest will come due following `timestamp`

### previousDueTimeAt

```solidity
function previousDueTimeAt(uint256 startTime, uint256 timestamp) external view returns (uint256)
```

Returns the previous timestamp where either principal or timestamp came due

### totalPrincipalPeriods

```solidity
function totalPrincipalPeriods() public view returns (uint256)
```

Returns the total number of principal periods

### totalInterestPeriods

```solidity
function totalInterestPeriods() public view returns (uint256)
```

Returns the total number of interest periods

### termEndTime

```solidity
function termEndTime(uint256 startTime) external view returns (uint256)
```

Returns the timestamp that the term will end

### termStartTime

```solidity
function termStartTime(uint256 startTime) external view returns (uint256)
```

Returns the timestamp that the term began

### previousInterestDueTimeAt

```solidity
function previousInterestDueTimeAt(uint256 startTime, uint256 timestamp) public view returns (uint256)
```

Returns the previous timestamp where new interest came due

### previousPrincipalDueTimeAt

```solidity
function previousPrincipalDueTimeAt(uint256 startTime, uint256 timestamp) public view returns (uint256)
```

Returns the previous timestamp where new principal came due

### nextPrincipalDueTimeAt

```solidity
function nextPrincipalDueTimeAt(uint256 startTime, uint256 timestamp) public view returns (uint256)
```

Returns the next time principal will come due, or the termEndTime if there are no more due times

### nextInterestDueTimeAt

```solidity
function nextInterestDueTimeAt(uint256 startTime, uint256 timestamp) public view returns (uint256)
```

Returns the next time interest will come due, or the termEndTime if there are no more due times

### periodEndTime

```solidity
function periodEndTime(uint256 startTime, uint256 period) public view returns (uint256)
```

Returns the end time of the given period.

### _termEndAbsolutePeriod

```solidity
function _termEndAbsolutePeriod(uint256 startTime) internal view returns (uint256)
```

Returns the absolute period that the terms will end in, accounting
          for the stub period

### _termStartAbsolutePeriod

```solidity
function _termStartAbsolutePeriod(uint256 startTime) internal view returns (uint256)
```

Returns the absolute period that the terms started in, accounting
          for the stub period

### _periodToPrincipalPeriod

```solidity
function _periodToPrincipalPeriod(uint256 p) internal view returns (uint256)
```

Convert a period to a principal period

### _periodToInterestPeriod

```solidity
function _periodToInterestPeriod(uint256 p) internal view returns (uint256)
```

Convert a period to an interest period

### _interestPeriodToPeriod

```solidity
function _interestPeriodToPeriod(uint256 p) internal view returns (uint256)
```

Convert an interest period to a normal period

### _principalPeriodToPeriod

```solidity
function _principalPeriodToPeriod(uint256 p) internal view returns (uint256)
```

Convert a principal period to a normal period

### _periodToAbsolutePeriod

```solidity
function _periodToAbsolutePeriod(uint256 startTime, uint256 p) internal view returns (uint256)
```

Convert a period to an absolute period. An absolute period is relative to
  the beginning of time rather than being relative to the start time

### _startOfPrincipalPeriod

```solidity
function _startOfPrincipalPeriod(uint256 startTime, uint256 principalPeriod) internal view returns (uint256)
```

Returns the starting timestamp of a principal period

### _startOfInterestPeriod

```solidity
function _startOfInterestPeriod(uint256 startTime, uint256 interestPeriod) internal view returns (uint256)
```

Returns the starting timestamp of an interest period


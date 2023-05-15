## GoldfinchFactory

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0xd20508E1E971b80EE172c73517905bfFfcBD87f9

Contract that allows us to create other contracts, such as CreditLines and BorrowerContracts
 Note GoldfinchFactory is a legacy name. More properly this can be considered simply the GoldfinchFactory

### config

```solidity
contract GoldfinchConfig config
```

### BORROWER_ROLE

```solidity
bytes32 BORROWER_ROLE
```

Role to allow for pool creation

### BorrowerCreated

```solidity
event BorrowerCreated(address borrower, address owner)
```

### PoolCreated

```solidity
event PoolCreated(contract ITranchedPool pool, address borrower)
```

### CallableLoanCreated

```solidity
event CallableLoanCreated(contract ICallableLoan loan, address borrower)
```

### CreditLineCreated

```solidity
event CreditLineCreated(contract ICreditLine creditLine)
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

### createCreditLine

```solidity
function createCreditLine() external returns (contract ICreditLine)
```

Allows anyone to create a CreditLine contract instance

_There is no value to calling this function directly. It is only meant to be called
 by a TranchedPool during it's creation process._

### createBorrower

```solidity
function createBorrower(address owner) external returns (address)
```

Allows anyone to create a Borrower contract instance

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The address that will own the new Borrower instance |

### createPool

```solidity
function createPool(address _borrower, uint256 _juniorFeePercent, uint256 _limit, uint256 _interestApr, contract ISchedule _schedule, uint256 _lateFeeApr, uint256 _fundableAt, uint256[] _allowedUIDTypes) external returns (contract ITranchedPool pool)
```

Allows anyone to create a new TranchedPool for a single borrower
Requirements:
 You are the admin or a borrower

### createCallableLoan

```solidity
function createCallableLoan(address _borrower, uint256 _limit, uint256 _interestApr, uint256 _numLockupPeriods, contract ISchedule _schedule, uint256 _lateFeeApr, uint256 _fundableAt, uint256[] _allowedUIDTypes) external returns (contract ICallableLoan loan)
```

Allows anyone to create a new CallableLoan for a single borrower
Requirements:
 You are the admin or a borrower

### createCallableLoanWithProxyOwner

```solidity
function createCallableLoanWithProxyOwner(address _proxyOwner, address _borrower, uint256 _limit, uint256 _interestApr, uint256 _numLockupPeriods, contract ISchedule _schedule, uint256 _lateFeeApr, uint256 _fundableAt, uint256[] _allowedUIDTypes) external returns (contract ICallableLoan loan)
```

Create a callable loan where the proxy owner is different than the borrower

### _createCallableLoanWithProxyOwner

```solidity
function _createCallableLoanWithProxyOwner(address _proxyOwner, address _borrower, uint256 _limit, uint256 _interestApr, uint256 _numLockupPeriods, contract ISchedule _schedule, uint256 _lateFeeApr, uint256 _fundableAt, uint256[] _allowedUIDTypes) internal returns (contract ICallableLoan loan)
```

### _deployMinimal

```solidity
function _deployMinimal(address _logic) internal returns (address proxy)
```

### isBorrower

```solidity
function isBorrower() public view returns (bool)
```

### onlyAdminOrBorrower

```solidity
modifier onlyAdminOrBorrower()
```


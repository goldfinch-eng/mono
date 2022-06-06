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
event PoolCreated(address pool, address borrower)
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### CreditLineCreated

```solidity
event CreditLineCreated(address creditLine)
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

### performUpgrade

```solidity
function performUpgrade() external
```

### _performUpgrade

```solidity
function _performUpgrade() internal
```

### createCreditLine

```solidity
function createCreditLine() external returns (address)
```

Allows anyone to create a CreditLine contract instance

_There is no value to calling this function directly. It is only meant to be called
 by a TranchedPool during it&#x27;s creation process._

### createBorrower

```solidity
function createBorrower(address owner) external returns (address)
```

Allows anyone to create a Borrower contract instance

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The address that will own the new Borrower instance |

### createPool

```solidity
function createPool(address _borrower, uint256 _juniorFeePercent, uint256 _limit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr, uint256 _principalGracePeriodInDays, uint256 _fundableAt, uint256[] _allowedUIDTypes) external returns (address pool)
```

Allows anyone to create a new TranchedPool for a single borrower

| Name | Type | Description |
| ---- | ---- | ----------- |
| _borrower | address | The borrower for whom the CreditLine will be created |
| _juniorFeePercent | uint256 | The percent of senior interest allocated to junior investors, expressed as  integer percents. eg. 20% is simply 20 |
| _limit | uint256 | The maximum amount a borrower can drawdown from this CreditLine |
| _interestApr | uint256 | The interest amount, on an annualized basis (APR, so non-compounding), expressed as an integer.  We assume 18 digits of precision. For example, to submit 15.34%, you would pass up 153400000000000000,  and 5.34% would be 53400000000000000 |
| _paymentPeriodInDays | uint256 | How many days in each payment period.  ie. the frequency with which they need to make payments. |
| _termInDays | uint256 | Number of days in the credit term. It is used to set the &#x60;termEndTime&#x60; upon first drawdown.  ie. The credit line should be fully paid off {_termIndays} days after the first drawdown. |
| _lateFeeApr | uint256 | The additional interest you will pay if you are late. For example, if this is 3%, and your  normal rate is 15%, then you will pay 18% while you are late. Also expressed as an 18 decimal precision integer Requirements:  You are the admin |
| _principalGracePeriodInDays | uint256 |  |
| _fundableAt | uint256 |  |
| _allowedUIDTypes | uint256[] |  |

### createMigratedPool

```solidity
function createMigratedPool(address _borrower, uint256 _juniorFeePercent, uint256 _limit, uint256 _interestApr, uint256 _paymentPeriodInDays, uint256 _termInDays, uint256 _lateFeeApr, uint256 _principalGracePeriodInDays, uint256 _fundableAt, uint256[] _allowedUIDTypes) external returns (address pool)
```

### updateGoldfinchConfig

```solidity
function updateGoldfinchConfig() external
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

### onlyCreditDesk

```solidity
modifier onlyCreditDesk()
```


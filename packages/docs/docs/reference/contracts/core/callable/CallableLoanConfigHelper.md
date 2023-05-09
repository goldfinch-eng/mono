## CallableLoanConfigHelper

A convenience library for getting easy access to other contracts and constants within the
 protocol, through the use of the IGoldfinchConfig contract

### getUSDC

```solidity
function getUSDC(contract IGoldfinchConfig config) internal view returns (contract IERC20UpgradeableWithDec)
```

### getPoolTokens

```solidity
function getPoolTokens(contract IGoldfinchConfig config) internal view returns (contract IPoolTokens)
```

### getGo

```solidity
function getGo(contract IGoldfinchConfig config) internal view returns (contract IGo)
```

### poolTokensAddress

```solidity
function poolTokensAddress(contract IGoldfinchConfig config) internal view returns (address)
```

### usdcAddress

```solidity
function usdcAddress(contract IGoldfinchConfig config) internal view returns (address)
```

### reserveAddress

```solidity
function reserveAddress(contract IGoldfinchConfig config) internal view returns (address)
```

### protocolAdminAddress

```solidity
function protocolAdminAddress(contract IGoldfinchConfig config) internal view returns (address)
```

### goAddress

```solidity
function goAddress(contract IGoldfinchConfig config) internal view returns (address)
```

### getDrawdownPeriodInSeconds

```solidity
function getDrawdownPeriodInSeconds(contract IGoldfinchConfig config) internal view returns (uint256)
```

### getLatenessGracePeriodInDays

```solidity
function getLatenessGracePeriodInDays(contract IGoldfinchConfig config) internal view returns (uint256)
```

### getReserveDenominator

```solidity
function getReserveDenominator(contract IGoldfinchConfig config) internal view returns (uint256)
```

### getWithdrawFeeDenominator

```solidity
function getWithdrawFeeDenominator(contract IGoldfinchConfig config) internal view returns (uint256)
```


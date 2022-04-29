## FixedLeverageRatioStrategy

### config

```solidity
contract GoldfinchConfig config
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config) public
```

### updateGoldfinchConfig

```solidity
function updateGoldfinchConfig() external
```

### getLeverageRatio

```solidity
function getLeverageRatio(contract ITranchedPool pool) public view returns (uint256)
```


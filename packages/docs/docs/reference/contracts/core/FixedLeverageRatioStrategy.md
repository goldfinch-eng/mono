## FixedLeverageRatioStrategy

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x71cfF40A44051C6e6311413A728EE7633dDC901a

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

### getLeverageRatio

```solidity
function getLeverageRatio(contract ITranchedPool) public view returns (uint256)
```


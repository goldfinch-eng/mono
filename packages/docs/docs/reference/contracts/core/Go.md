## Go

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x84AC02474c4656C88d4e08FCA63ff73070787C3d

### ZAPPER_ROLE

```solidity
bytes32 ZAPPER_ROLE
```

### uniqueIdentity

```solidity
address uniqueIdentity
```

Returns the address of the UniqueIdentity contract.

### config

```solidity
contract GoldfinchConfig config
```

### legacyGoList

```solidity
contract GoldfinchConfig legacyGoList
```

### allIdTypes

```solidity
uint256[11] allIdTypes
```

### GoldfinchConfigUpdated

```solidity
event GoldfinchConfigUpdated(address who, address configAddress)
```

### initialize

```solidity
function initialize(address owner, contract GoldfinchConfig _config, address _uniqueIdentity) public
```

### performUpgrade

```solidity
function performUpgrade() external
```

### _performUpgrade

```solidity
function _performUpgrade() internal
```

### setLegacyGoList

```solidity
function setLegacyGoList(contract GoldfinchConfig _legacyGoList) external
```

sets the config that will be used as the source of truth for the go
list instead of the config currently associated. To use the associated config for to list, set the override
to the null address.

### go

```solidity
function go(address account) public view returns (bool)
```

Returns whether the provided account is go-listed for use of the Goldfinch protocol
for any of the UID token types.
This status is defined as: whether `balanceOf(account, id)` on the UniqueIdentity
contract is non-zero (where `id` is a supported token id on UniqueIdentity), falling back to the
account's status on the legacy go-list maintained on GoldfinchConfig.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account whose go status to obtain |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The account's go status |

### goOnlyIdTypes

```solidity
function goOnlyIdTypes(address account, uint256[] onlyIdTypes) public view returns (bool)
```

Returns whether the provided account is go-listed for use of the Goldfinch protocol
for defined UID token types

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account whose go status to obtain |
| onlyIdTypes | uint256[] | Array of id types to check balances |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The account's go status |

### getSeniorPoolIdTypes

```solidity
function getSeniorPoolIdTypes() public pure returns (uint256[])
```

### goSeniorPool

```solidity
function goSeniorPool(address account) public view returns (bool)
```

Returns whether the provided account is go-listed for use of the SeniorPool on the Goldfinch protocol.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account whose go status to obtain |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The account's go status |

### _getLegacyGoList

```solidity
function _getLegacyGoList() internal view returns (contract GoldfinchConfig)
```

### initZapperRole

```solidity
function initZapperRole() external
```


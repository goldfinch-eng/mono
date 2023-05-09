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

### goOnlyIdTypes

```solidity
function goOnlyIdTypes(address account, uint256[] onlyIdTypes) public view returns (bool)
```

Returns whether the provided account is:
1. go-listed for use of the Goldfinch protocol for any of the provided UID token types
2. is allowed to act on behalf of the go-listed EOA initiating this transaction
Go-listed is defined as: whether `balanceOf(account, id)` on the UniqueIdentity
contract is non-zero (where `id` is a supported token id on UniqueIdentity), falling back to the
account's status on the legacy go-list maintained on GoldfinchConfig.

_If tx.origin is 0x0 (e.g. in blockchain explorers such as Etherscan) this function will
     throw an error if the account is not go listed._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account whose go status to obtain |
| onlyIdTypes | uint256[] | Array of id types to check balances |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The account's go status |

### getAllIdTypes

```solidity
function getAllIdTypes() public view returns (uint256[])
```

Returns a dynamic array of all UID types

### getSeniorPoolIdTypes

```solidity
function getSeniorPoolIdTypes() public pure returns (uint256[])
```

Returns a dynamic array of UID types accepted by the senior pool

### go

```solidity
function go(address account) public view returns (bool)
```

Returns whether the provided account is go-listed for any UID type

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account whose go status to obtain |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The account's go status |

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


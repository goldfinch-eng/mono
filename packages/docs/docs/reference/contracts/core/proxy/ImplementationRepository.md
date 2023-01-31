## ImplementationRepository

### INVALID_IMPL

```solidity
address INVALID_IMPL
```

### INVALID_LINEAGE_ID

```solidity
uint256 INVALID_LINEAGE_ID
```

### upgradeDataFor

```solidity
mapping(address => bytes) upgradeDataFor
```

returns data that will be delegatedCalled when the given implementation
          is upgraded to

### _nextImplementationOf

```solidity
mapping(address => address) _nextImplementationOf
```

_mapping from one implementation to the succeeding implementation_

### lineageIdOf

```solidity
mapping(address => uint256) lineageIdOf
```

Returns the id of the lineage a given implementation belongs to

### _currentOfLineage

```solidity
mapping(uint256 => address) _currentOfLineage
```

_internal because we expose this through the `currentImplementation(uint256)` api_

### currentLineageId

```solidity
uint256 currentLineageId
```

Returns the id of the most recently created lineage

### initialize

```solidity
function initialize(address _owner, address implementation) external
```

initialize the repository's state

_reverts if `_owner` is the null address
reverts if `implementation` is not a contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | owner of the repository |
| implementation | address | initial implementation in the repository |

### setUpgradeDataFor

```solidity
function setUpgradeDataFor(address implementation, bytes data) external
```

set data that will be delegate called when a proxy upgrades to the given `implementation`

_reverts when caller is not an admin
reverts when the contract is paused
reverts if the given implementation isn't registered_

### createLineage

```solidity
function createLineage(address implementation) external returns (uint256)
```

Create a new lineage of implementations.

This creates a new "root" of a new lineage

_reverts if `implementation` is not a contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation that will be the first implementation in the lineage |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | newly created lineage's id |

### append

```solidity
function append(address implementation) external
```

add a new implementation and set it as the current implementation

_reverts if the sender is not an owner
reverts if the contract is paused
reverts if `implementation` is not a contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation to append |

### append

```solidity
function append(address implementation, uint256 lineageId) external
```

Append an implementation to a specified lineage

_reverts if the contract is paused
reverts if the sender is not an owner
reverts if `implementation` is not a contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation to append |
| lineageId | uint256 | id of lineage to append to |

### remove

```solidity
function remove(address toRemove, address previous) external
```

Remove an implementation from the chain and "stitch" together its neighbors

_If you have a chain of `A -> B -> C` and I call `remove(B, C)` it will result in `A -> C`
reverts if `previos` is not the ancestor of `toRemove`
we need to provide the previous implementation here to be able to successfully "stitch"
      the chain back together. Because this is an admin action, we can source what the previous
      version is from events._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| toRemove | address | Implementation to remove |
| previous | address | Implementation that currently has `toRemove` as its successor |

### hasNext

```solidity
function hasNext(address implementation) external view returns (bool)
```

Returns `true` if an implementation has a next implementation set

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The implementation following the given implementation |

### has

```solidity
function has(address implementation) external view returns (bool)
```

Returns `true` if an implementation has already been added

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | Implementation to check existence of |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | `true` if the implementation has already been added |

### nextImplementationOf

```solidity
function nextImplementationOf(address implementation) external view returns (address)
```

Get the next implementation for a given implementation or
          `address(0)` if it doesn't exist

_reverts when contract is paused_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation to get the upgraded implementation for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Next Implementation |

### lineageExists

```solidity
function lineageExists(uint256 lineageId) external view returns (bool)
```

Returns `true` if a given lineageId exists

### currentImplementation

```solidity
function currentImplementation(uint256 lineageId) external view returns (address)
```

Return the current implementation of a lineage with the given `lineageId`

### currentImplementation

```solidity
function currentImplementation() external view returns (address)
```

return current implementaton of the current lineage

### _setUpgradeDataFor

```solidity
function _setUpgradeDataFor(address implementation, bytes data) internal
```

### _createLineage

```solidity
function _createLineage(address implementation) internal virtual returns (uint256)
```

### _currentImplementation

```solidity
function _currentImplementation(uint256 lineageId) internal view returns (address)
```

### _has

```solidity
function _has(address implementation) internal view virtual returns (bool)
```

Returns `true` if an implementation has already been added

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation to check for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | `true` if the implementation has already been added |

### _append

```solidity
function _append(address implementation, uint256 lineageId) internal virtual
```

Set an implementation to the current implementation

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation to set as current implementation |
| lineageId | uint256 | id of lineage to append to |

### _remove

```solidity
function _remove(address toRemove, address previous) internal virtual
```

### _lineageExists

```solidity
function _lineageExists(uint256 lineageId) internal view returns (bool)
```

### Added

```solidity
event Added(uint256 lineageId, address newImplementation, address oldImplementation)
```

### Removed

```solidity
event Removed(uint256 lineageId, address implementation)
```

### UpgradeDataSet

```solidity
event UpgradeDataSet(address implementation, bytes data)
```


## VersionedImplementationRepository

### _byVersion

```solidity
mapping(bytes => address) _byVersion
```

_abi encoded version -> implementation address
we use bytes here so only a single storage slot is used_

### getByVersion

```solidity
function getByVersion(uint8[3] version) external view returns (address)
```

get an implementation by a version tag

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| version | uint8[3] | `[major, minor, patch]` version tag |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | implementation associated with the given version tag |

### hasVersion

```solidity
function hasVersion(uint8[3] version) external view returns (bool)
```

check if a version exists

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| version | uint8[3] | `[major, minor, patch]` version tag |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | true if the version is registered |

### _append

```solidity
function _append(address implementation, uint256 lineageId) internal
```

Set an implementation to the current implementation

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| implementation | address | implementation to set as current implementation |
| lineageId | uint256 | id of lineage to append to |

### _createLineage

```solidity
function _createLineage(address implementation) internal returns (uint256)
```

### _remove

```solidity
function _remove(address toRemove, address previous) internal
```

### _insertVersion

```solidity
function _insertVersion(uint8[3] version, address impl) internal
```

### _removeVersion

```solidity
function _removeVersion(uint8[3] version) internal
```

### _hasVersion

```solidity
function _hasVersion(uint8[3] version) internal view returns (bool)
```

### VersionAdded

```solidity
event VersionAdded(uint8[3] version, address impl)
```

### VersionRemoved

```solidity
event VersionRemoved(uint8[3] version, address impl)
```


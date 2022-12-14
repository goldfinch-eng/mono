## Epochs

### EPOCH_SECONDS

```solidity
uint256 EPOCH_SECONDS
```

### fromSeconds

```solidity
function fromSeconds(uint256 s) internal pure returns (uint256)
```

Get the epoch containing the timestamp `s`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| s | uint256 | the timestamp |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | corresponding epoch |

### current

```solidity
function current() internal view returns (uint256)
```

Get the current epoch for the block.timestamp

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | current epoch |

### currentEpochStartTimestamp

```solidity
function currentEpochStartTimestamp() internal view returns (uint256)
```

Get the start timestamp for the current epoch

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | current epoch start timestamp |

### previous

```solidity
function previous() internal view returns (uint256)
```

Get the previous epoch given block.timestamp

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | previous epoch |

### next

```solidity
function next() internal view returns (uint256)
```

Get the next epoch given block.timestamp

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | next epoch |

### startOf

```solidity
function startOf(uint256 epoch) internal pure returns (uint256)
```

Get the Unix timestamp of the start of `epoch`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| epoch | uint256 | the epoch |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | unix timestamp |


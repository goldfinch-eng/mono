## UserEpochTotal

```solidity
struct UserEpochTotal {
  uint256 totalAmount;
  uint256 eligibleAmount;
  uint256 checkpointedAt;
}
```

## UserEpochTotals

### InvalidDepositEpoch

```solidity
error InvalidDepositEpoch(uint256 epoch)
```

### recordIncrease

```solidity
function recordIncrease(struct UserEpochTotal total, uint256 amount) internal
```

Record an increase of `amount` in the `total`. This is counted toward the
 nextAmount as deposits must be present for an entire epoch to be valid.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| total | struct UserEpochTotal | storage pointer to the UserEpochTotal |
| amount | uint256 | amount to increase the total by |

### recordInstantIncrease

```solidity
function recordInstantIncrease(struct UserEpochTotal total, uint256 amount, uint256 depositTimestamp) internal
```

Record an increase of `amount` instantly based on the time of the deposit.
 This is counted either:
 1. To just the totalAmount if the deposit was this epoch
 2. To both the totalAmount and eligibleAmount if the deposit was before this epoch

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| total | struct UserEpochTotal | storage pointer to the UserEpochTotal |
| amount | uint256 | amount to increase the total by |
| depositTimestamp | uint256 |  |

### recordDecrease

```solidity
function recordDecrease(struct UserEpochTotal total, uint256 amount, uint256 depositTimestamp) internal
```

Record a decrease of `amount` in the `total`. Depending on the `depositTimestamp`
 this will withdraw from the total's currentAmount (if it's withdrawn from an already valid deposit)
 or from the total's nextAmount (if it's withdrawn from a deposit this epoch).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| total | struct UserEpochTotal | storage pointer to the UserEpochTotal |
| amount | uint256 | amount to decrease the total by |
| depositTimestamp | uint256 | timestamp of the deposit associated with `amount` |

### getTotals

```solidity
function getTotals(struct UserEpochTotal _total) internal view returns (uint256 current, uint256 next)
```

Get the up-to-date current and next amount for the `_total`. UserEpochTotals
 may have a lastEpochUpdate of long ago. This returns the current and next amounts as if it had
 been checkpointed just now.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _total | struct UserEpochTotal | storage pointer to the UserEpochTotal |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| current | uint256 | the currentAmount of the UserEpochTotal |
| next | uint256 | the nextAmount of the UserEpochTotal |

### _checkpoint

```solidity
function _checkpoint(struct UserEpochTotal total) private
```


## LeverageRatioStrategy

### LEVERAGE_RATIO_DECIMALS

```solidity
uint256 LEVERAGE_RATIO_DECIMALS
```

### invest

```solidity
function invest(contract ISeniorPool, contract ITranchedPool pool) public view returns (uint256)
```

Determines how much money to invest in the senior tranche based on what is committed to the junior
tranche, what is committed to the senior tranche, and a leverage ratio to the junior tranche. Because
it takes into account what is already committed to the senior tranche, the value returned by this
function can be used "idempotently" to achieve the investment target amount without exceeding that target.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | contract ISeniorPool |  |
| pool | contract ITranchedPool | The tranched pool to invest into (as the senior) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### estimateInvestment

```solidity
function estimateInvestment(contract ISeniorPool, contract ITranchedPool pool) public view returns (uint256)
```

A companion of `invest()`: determines how much would be returned by `invest()`, as the
value to invest into the senior tranche, if the junior tranche were locked and the senior tranche
were not locked.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | contract ISeniorPool |  |
| pool | contract ITranchedPool | The tranched pool to invest into (as the senior) |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of money to invest into the tranched pool's senior tranche, from the senior pool |

### _invest

```solidity
function _invest(contract ITranchedPool pool, struct ITranchedPool.TrancheInfo juniorTranche, struct ITranchedPool.TrancheInfo seniorTranche) internal view returns (uint256)
```

### _getTranchesInSlice

```solidity
function _getTranchesInSlice(contract ITranchedPool pool, uint256 sliceIndex) internal view returns (struct ITranchedPool.TrancheInfo, struct ITranchedPool.TrancheInfo)
```

Return the junior and senior tranches from a given pool in a specified slice

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | pool to fetch tranches from |
| sliceIndex | uint256 | slice index to fetch tranches from |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ITranchedPool.TrancheInfo | (juniorTranche, seniorTranche) |
| [1] | struct ITranchedPool.TrancheInfo |  |

### _sliceIndexToJuniorTrancheId

```solidity
function _sliceIndexToJuniorTrancheId(uint256 index) internal pure returns (uint256)
```

Returns the junior tranche id for the given slice index

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | slice index |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | junior tranche id of given slice index |

### _sliceIndexToSeniorTrancheId

```solidity
function _sliceIndexToSeniorTrancheId(uint256 index) internal pure returns (uint256)
```

Returns the senion tranche id for the given slice index

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | slice index |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | senior tranche id of given slice index |


## LeverageRatioStrategy

### LEVERAGE_RATIO_DECIMALS

```solidity
uint256 LEVERAGE_RATIO_DECIMALS
```

### invest

```solidity
function invest(contract ISeniorPool seniorPool, contract ITranchedPool pool) public view returns (uint256)
```

Determines how much money to invest in the senior tranche based on what is committed to the junior
tranche, what is committed to the senior tranche, and a leverage ratio to the junior tranche. Because
it takes into account what is already committed to the senior tranche, the value returned by this
function can be used &quot;idempotently&quot; to achieve the investment target amount without exceeding that target.

| Name | Type | Description |
| ---- | ---- | ----------- |
| seniorPool | contract ISeniorPool | The senior pool to invest from |
| pool | contract ITranchedPool | The tranched pool to invest into (as the senior) |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of money to invest into the tranched pool&#x27;s senior tranche, from the senior pool |

### estimateInvestment

```solidity
function estimateInvestment(contract ISeniorPool seniorPool, contract ITranchedPool pool) public view returns (uint256)
```

A companion of &#x60;invest()&#x60;: determines how much would be returned by &#x60;invest()&#x60;, as the
value to invest into the senior tranche, if the junior tranche were locked and the senior tranche
were not locked.

| Name | Type | Description |
| ---- | ---- | ----------- |
| seniorPool | contract ISeniorPool | The senior pool to invest from |
| pool | contract ITranchedPool | The tranched pool to invest into (as the senior) |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of money to invest into the tranched pool&#x27;s senior tranche, from the senior pool |

### _invest

```solidity
function _invest(contract ITranchedPool pool, struct ITranchedPool.TrancheInfo juniorTranche, struct ITranchedPool.TrancheInfo seniorTranche) internal view returns (uint256)
```

### _getTranchesInSlice

```solidity
function _getTranchesInSlice(contract ITranchedPool pool, uint256 sliceIndex) internal view returns (struct ITranchedPool.TrancheInfo, struct ITranchedPool.TrancheInfo)
```

Return the junior and senior tranches from a given pool in a specified slice

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract ITranchedPool | pool to fetch tranches from |
| sliceIndex | uint256 | slice index to fetch tranches from |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct ITranchedPool.TrancheInfo | (juniorTranche, seniorTranche) |
| [1] | struct ITranchedPool.TrancheInfo |  |

### _sliceIndexToJuniorTrancheId

```solidity
function _sliceIndexToJuniorTrancheId(uint256 index) internal pure returns (uint256)
```

Returns the junior tranche id for the given slice index

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | slice index |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | junior tranche id of given slice index |

### _sliceIndexToSeniorTrancheId

```solidity
function _sliceIndexToSeniorTrancheId(uint256 index) internal pure returns (uint256)
```

Returns the senion tranche id for the given slice index

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | slice index |

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | senior tranche id of given slice index |


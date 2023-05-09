## TranchingLogic

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x100656CbB440D37a7880F4c5BD4aC5edcf411066

Library for handling the payments waterfall

### SliceInfo

```solidity
struct SliceInfo {
  uint256 reserveFeePercent;
  uint256 interestAccrued;
  uint256 principalAccrued;
}
```

### ApplyResult

```solidity
struct ApplyResult {
  uint256 interestRemaining;
  uint256 principalRemaining;
  uint256 reserveDeduction;
  uint256 oldInterestSharePrice;
  uint256 oldPrincipalSharePrice;
}
```

### FP_SCALING_FACTOR

```solidity
uint256 FP_SCALING_FACTOR
```

### NUM_TRANCHES_PER_SLICE

```solidity
uint256 NUM_TRANCHES_PER_SLICE
```

### usdcToSharePrice

```solidity
function usdcToSharePrice(uint256 amount, uint256 totalShares) public pure returns (uint256)
```

### sharePriceToUsdc

```solidity
function sharePriceToUsdc(uint256 sharePrice, uint256 totalShares) public pure returns (uint256)
```

### lockTranche

```solidity
function lockTranche(struct ITranchedPool.TrancheInfo tranche, contract GoldfinchConfig config) external
```

### redeemableInterestAndPrincipal

```solidity
function redeemableInterestAndPrincipal(struct ITranchedPool.TrancheInfo trancheInfo, struct IPoolTokens.TokenInfo tokenInfo) public view returns (uint256, uint256)
```

### calculateExpectedSharePrice

```solidity
function calculateExpectedSharePrice(struct ITranchedPool.TrancheInfo tranche, uint256 amount, struct ITranchedPool.PoolSlice slice) public pure returns (uint256)
```

### scaleForSlice

```solidity
function scaleForSlice(struct ITranchedPool.PoolSlice slice, uint256 amount, uint256 totalDeployed) public pure returns (uint256)
```

### getSliceInfo

```solidity
function getSliceInfo(struct ITranchedPool.PoolSlice slice, contract ICreditLine creditLine, uint256 totalDeployed, uint256 reserveFeePercent) public view returns (struct TranchingLogic.SliceInfo)
```

### getTotalInterestAndPrincipal

```solidity
function getTotalInterestAndPrincipal(struct ITranchedPool.PoolSlice slice, contract ICreditLine creditLine, uint256 totalDeployed) public view returns (uint256, uint256)
```

### scaleByFraction

```solidity
function scaleByFraction(uint256 amount, uint256 fraction, uint256 total) public pure returns (uint256)
```

### applyToAllSlices

```solidity
function applyToAllSlices(mapping(uint256 => struct ITranchedPool.PoolSlice) poolSlices, uint256 numSlices, uint256 interest, uint256 principal, uint256 reserveFeePercent, uint256 totalDeployed, contract ICreditLine creditLine, uint256 juniorFeePercent) external returns (uint256)
```

apply a payment to all slices

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolSlices | mapping(uint256 &#x3D;&gt; struct ITranchedPool.PoolSlice) | slices to apply to |
| numSlices | uint256 | number of slices |
| interest | uint256 | amount of interest to apply |
| principal | uint256 | amount of principal to apply |
| reserveFeePercent | uint256 | percentage that protocol will take for reserves |
| totalDeployed | uint256 | total amount of principal deployed |
| creditLine | contract ICreditLine | creditline to account for |
| juniorFeePercent | uint256 | percentage the junior tranche will take |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | total amount that will be sent to reserves |

### applyToAllSeniorTranches

```solidity
function applyToAllSeniorTranches(mapping(uint256 => struct ITranchedPool.PoolSlice) poolSlices, uint256 numSlices, uint256 interest, uint256 principal, uint256 reserveFeePercent, uint256 totalDeployed, contract ICreditLine creditLine, uint256 juniorFeePercent) internal returns (struct TranchingLogic.ApplyResult)
```

### applyToAllJuniorTranches

```solidity
function applyToAllJuniorTranches(mapping(uint256 => struct ITranchedPool.PoolSlice) poolSlices, uint256 numSlices, uint256 interest, uint256 principal, uint256 reserveFeePercent, uint256 totalDeployed, contract ICreditLine creditLine) internal returns (uint256 totalReserveAmount)
```

### emitSharePriceUpdatedEvent

```solidity
function emitSharePriceUpdatedEvent(struct ITranchedPool.TrancheInfo tranche, struct TranchingLogic.ApplyResult applyResult) internal
```

### applyToSeniorTranche

```solidity
function applyToSeniorTranche(struct ITranchedPool.PoolSlice slice, uint256 interestRemaining, uint256 principalRemaining, uint256 juniorFeePercent, struct TranchingLogic.SliceInfo sliceInfo) internal returns (struct TranchingLogic.ApplyResult)
```

### applyToJuniorTranche

```solidity
function applyToJuniorTranche(struct ITranchedPool.PoolSlice slice, uint256 interestRemaining, uint256 principalRemaining, struct TranchingLogic.SliceInfo sliceInfo) public returns (struct TranchingLogic.ApplyResult)
```

### trancheIdToSliceIndex

```solidity
function trancheIdToSliceIndex(uint256 trancheId) external pure returns (uint256)
```

### initializeNextSlice

```solidity
function initializeNextSlice(mapping(uint256 => struct ITranchedPool.PoolSlice) poolSlices, uint256 sliceIndex) external
```

### sliceIndexToJuniorTrancheId

```solidity
function sliceIndexToJuniorTrancheId(uint256 sliceIndex) public pure returns (uint256)
```

### sliceIndexToSeniorTrancheId

```solidity
function sliceIndexToSeniorTrancheId(uint256 sliceIndex) public pure returns (uint256)
```

### isSeniorTrancheId

```solidity
function isSeniorTrancheId(uint256 trancheId) external pure returns (bool)
```

### isJuniorTrancheId

```solidity
function isJuniorTrancheId(uint256 trancheId) external pure returns (bool)
```

### _applyToSharePrice

```solidity
function _applyToSharePrice(uint256 amountRemaining, uint256 currentSharePrice, uint256 desiredAmount, uint256 totalShares) internal pure returns (uint256, uint256)
```

### _scaleByPercentOwnership

```solidity
function _scaleByPercentOwnership(struct ITranchedPool.TrancheInfo tranche, uint256 amount, struct ITranchedPool.PoolSlice slice) internal pure returns (uint256)
```

### _desiredAmountFromSharePrice

```solidity
function _desiredAmountFromSharePrice(uint256 desiredSharePrice, uint256 actualSharePrice, uint256 totalShares) internal pure returns (uint256)
```

### _applyByAmount

```solidity
function _applyByAmount(struct ITranchedPool.TrancheInfo tranche, uint256 interestRemaining, uint256 principalRemaining, uint256 desiredInterestAmount, uint256 desiredPrincipalAmount) internal returns (uint256, uint256)
```

### _applyBySharePrice

```solidity
function _applyBySharePrice(struct ITranchedPool.TrancheInfo tranche, uint256 interestRemaining, uint256 principalRemaining, uint256 desiredInterestSharePrice, uint256 desiredPrincipalSharePrice) internal returns (uint256, uint256)
```

### TrancheLocked

```solidity
event TrancheLocked(address pool, uint256 trancheId, uint256 lockedUntil)
```

### SharePriceUpdated

```solidity
event SharePriceUpdated(address pool, uint256 tranche, uint256 principalSharePrice, int256 principalDelta, uint256 interestSharePrice, int256 interestDelta)
```


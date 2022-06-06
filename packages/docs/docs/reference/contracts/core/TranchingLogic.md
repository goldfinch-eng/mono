## TranchingLogic

**Deployment on Ethereum mainnet: **

https://etherscan.io/address/0x9BCE1F08012DD6e72756Cd015E50068f90963D22

Library for handling the payments waterfall

### SharePriceUpdated

```solidity
event SharePriceUpdated(address pool, uint256 tranche, uint256 principalSharePrice, int256 principalDelta, uint256 interestSharePrice, int256 interestDelta)
```

### FP_SCALING_FACTOR

```solidity
uint256 FP_SCALING_FACTOR
```

### ONE_HUNDRED

```solidity
uint256 ONE_HUNDRED
```

### usdcToSharePrice

```solidity
function usdcToSharePrice(uint256 amount, uint256 totalShares) public pure returns (uint256)
```

### sharePriceToUsdc

```solidity
function sharePriceToUsdc(uint256 sharePrice, uint256 totalShares) public pure returns (uint256)
```

### redeemableInterestAndPrincipal

```solidity
function redeemableInterestAndPrincipal(struct ITranchedPool.TrancheInfo trancheInfo, struct IPoolTokens.TokenInfo tokenInfo) public view returns (uint256 interestRedeemable, uint256 principalRedeemable)
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
function getSliceInfo(struct ITranchedPool.PoolSlice slice, contract IV2CreditLine creditLine, uint256 totalDeployed, uint256 reserveFeePercent) public view returns (struct ITranchedPool.SliceInfo)
```

### getTotalInterestAndPrincipal

```solidity
function getTotalInterestAndPrincipal(struct ITranchedPool.PoolSlice slice, contract IV2CreditLine creditLine, uint256 totalDeployed) public view returns (uint256 interestAccrued, uint256 principalAccrued)
```

### scaleByFraction

```solidity
function scaleByFraction(uint256 amount, uint256 fraction, uint256 total) public pure returns (uint256)
```

### applyToAllSeniorTranches

```solidity
function applyToAllSeniorTranches(struct ITranchedPool.PoolSlice[] poolSlices, uint256 interest, uint256 principal, uint256 reserveFeePercent, uint256 totalDeployed, contract IV2CreditLine creditLine, uint256 juniorFeePercent) public returns (struct ITranchedPool.ApplyResult)
```

### applyToAllJuniorTranches

```solidity
function applyToAllJuniorTranches(struct ITranchedPool.PoolSlice[] poolSlices, uint256 interest, uint256 principal, uint256 reserveFeePercent, uint256 totalDeployed, contract IV2CreditLine creditLine) public returns (uint256 totalReserveAmount)
```

### emitSharePriceUpdatedEvent

```solidity
function emitSharePriceUpdatedEvent(struct ITranchedPool.TrancheInfo tranche, struct ITranchedPool.ApplyResult applyResult) internal
```

### applyToSeniorTranche

```solidity
function applyToSeniorTranche(struct ITranchedPool.PoolSlice slice, uint256 interestRemaining, uint256 principalRemaining, uint256 juniorFeePercent, struct ITranchedPool.SliceInfo sliceInfo) public returns (struct ITranchedPool.ApplyResult)
```

### applyToJuniorTranche

```solidity
function applyToJuniorTranche(struct ITranchedPool.PoolSlice slice, uint256 interestRemaining, uint256 principalRemaining, struct ITranchedPool.SliceInfo sliceInfo) public returns (struct ITranchedPool.ApplyResult)
```

### applyBySharePrice

```solidity
function applyBySharePrice(struct ITranchedPool.TrancheInfo tranche, uint256 interestRemaining, uint256 principalRemaining, uint256 desiredInterestSharePrice, uint256 desiredPrincipalSharePrice) public returns (uint256, uint256)
```

### applyByAmount

```solidity
function applyByAmount(struct ITranchedPool.TrancheInfo tranche, uint256 interestRemaining, uint256 principalRemaining, uint256 desiredInterestAmount, uint256 desiredPrincipalAmount) public returns (uint256, uint256)
```

### migrateAccountingVariables

```solidity
function migrateAccountingVariables(address originalClAddr, address newClAddr) public
```

### closeCreditLine

```solidity
function closeCreditLine(address originalCl) public
```

### desiredAmountFromSharePrice

```solidity
function desiredAmountFromSharePrice(uint256 desiredSharePrice, uint256 actualSharePrice, uint256 totalShares) public pure returns (uint256)
```

### applyToSharePrice

```solidity
function applyToSharePrice(uint256 amountRemaining, uint256 currentSharePrice, uint256 desiredAmount, uint256 totalShares) public pure returns (uint256, uint256)
```

### scaleByPercentOwnership

```solidity
function scaleByPercentOwnership(struct ITranchedPool.TrancheInfo tranche, uint256 amount, struct ITranchedPool.PoolSlice slice) public pure returns (uint256)
```


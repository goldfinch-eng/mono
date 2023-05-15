## Waterfall

```solidity
struct Waterfall {
  struct Tranche[] _tranches;
  uint256[31] __padding;
}
```

## WaterfallLogic

### MINIMUM_WATERFALL_TRANCHES

```solidity
uint256 MINIMUM_WATERFALL_TRANCHES
```

### initialize

```solidity
function initialize(struct Waterfall w, uint256 nTranches) internal
```

### pay

```solidity
function pay(struct Waterfall w, uint256 principalAmount, uint256 interestAmount, uint256 reserveTranchesIndexStart) internal
```

apply a payment to tranches in the waterfall.
        The principal payment is applied to the tranches in order of priority
        The interest payment is applied to the tranches pro rata

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| w | struct Waterfall |  |
| principalAmount | uint256 |  |
| interestAmount | uint256 |  |
| reserveTranchesIndexStart | uint256 |  |

### drawdown

```solidity
function drawdown(struct Waterfall w, uint256 principalAmount) internal
```

### move

```solidity
function move(struct Waterfall w, uint256 principalOutstanding, uint256 toCallRequestPeriodTrancheId) internal returns (uint256 principalDeposited, uint256 principalPaid, uint256 principalReserved, uint256 interestPaid)
```

Move principal and paid interest from one tranche to another

### withdraw

```solidity
function withdraw(struct Waterfall w, uint256 principalAmount) internal
```

Withdraw principal from the uncalled tranche.
            Assumes that the caller is allowed to withdraw.

### deposit

```solidity
function deposit(struct Waterfall w, uint256 principalAmount) internal
```

Deposits principal into the uncalled tranche.
            Assumes that the caller is allowed to deposit.

### settleReserves

```solidity
function settleReserves(struct Waterfall w, uint256 currentTrancheIndex) internal
```

Settle all past due tranches as well as the last tranche.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| w | struct Waterfall |  |
| currentTrancheIndex | uint256 | - Index of the current tranche. All previous tranches are due. |

### getTranche

```solidity
function getTranche(struct Waterfall w, uint256 trancheId) internal view returns (struct Tranche)
```

### numTranches

```solidity
function numTranches(struct Waterfall w) internal view returns (uint256)
```

### uncalledCapitalTrancheIndex

```solidity
function uncalledCapitalTrancheIndex(struct Waterfall w) internal view returns (uint256)
```

### totalPrincipalDeposited

```solidity
function totalPrincipalDeposited(struct Waterfall w) internal view returns (uint256 sum)
```

Returns the total amount of principal paid to all tranches

### totalInterestPaid

```solidity
function totalInterestPaid(struct Waterfall w) internal view returns (uint256 sum)
```

Returns the total amount of interest paid to all tranches

### totalPrincipalPaidAfterSettlementUpToTranche

```solidity
function totalPrincipalPaidAfterSettlementUpToTranche(struct Waterfall w, uint256 trancheIndex) internal view returns (uint256 sum)
```

Returns the total amount of principal paid to all tranches

### totalPrincipalPaid

```solidity
function totalPrincipalPaid(struct Waterfall w) internal view returns (uint256 totalPrincipalPaidSum)
```

Returns the total amount of principal paid to all tranches

### totalPrincipalOutstandingBeforeReserves

```solidity
function totalPrincipalOutstandingBeforeReserves(struct Waterfall w) internal view returns (uint256 sum)
```

### totalPrincipalOutstandingAfterReserves

```solidity
function totalPrincipalOutstandingAfterReserves(struct Waterfall w) internal view returns (uint256 sum)
```

### totalPrincipalReservedUpToTranche

```solidity
function totalPrincipalReservedUpToTranche(struct Waterfall w, uint256 trancheIndex) internal view returns (uint256 sum)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| w | struct Waterfall |  |
| trancheIndex | uint256 | Exclusive upper bound (i.e. the tranche at this index is not included) |

### totalPrincipalDepositedUpToTranche

```solidity
function totalPrincipalDepositedUpToTranche(struct Waterfall w, uint256 trancheIndex) internal view returns (uint256 sum)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| w | struct Waterfall |  |
| trancheIndex | uint256 | Exclusive upper bound (i.e. the tranche at this index is not included) |


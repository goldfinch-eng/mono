## Tranche

```solidity
struct Tranche {
  uint256 _principalDeposited;
  uint256 _principalPaid;
  uint256 _principalReserved;
  uint256 _interestPaid;
  uint256[28] __padding;
}
```

## TrancheLogic

### settleReserves

```solidity
function settleReserves(struct Tranche t) internal
```

### pay

```solidity
function pay(struct Tranche t, uint256 principalAmount, uint256 interestAmount) internal
```

### reserve

```solidity
function reserve(struct Tranche t, uint256 principalAmount, uint256 interestAmount) internal
```

### principalOutstandingBeforeReserves

```solidity
function principalOutstandingBeforeReserves(struct Tranche t) internal view returns (uint256)
```

Returns principal outstanding, omitting _principalReserved.

### principalOutstandingAfterReserves

```solidity
function principalOutstandingAfterReserves(struct Tranche t) internal view returns (uint256)
```

Returns principal outstanding, taking into account any _principalReserved.

### withdraw

```solidity
function withdraw(struct Tranche t, uint256 principal) internal
```

Only valid for Uncalled Tranche
Withdraw principal from tranche - effectively nullifying the deposit.

_reverts if interest has been paid to tranche_

### take

```solidity
function take(struct Tranche t, uint256 principalOutstandingToTake) internal returns (uint256 principalDepositedTaken, uint256 principalPaidTaken, uint256 principalReservedTaken, uint256 interestTaken)
```

Only valid for Uncalled Tranche
remove `principalOutstanding` from the Tranche and its corresponding interest.
        Take as much reserved principal as possible.
        Only applicable to the uncalled tranche.

### deposit

```solidity
function deposit(struct Tranche t, uint256 principal) internal
```

Only valid for Uncalled Tranche
depositing into the tranche for the first time(uncalled)

### addToBalances

```solidity
function addToBalances(struct Tranche t, uint256 addToPrincipalDeposited, uint256 addToPrincipalPaid, uint256 addToPrincipalReserved, uint256 addToInterestPaid) internal
```

Only valid for Callable Principal Tranches in the context of a call submission

### principalDeposited

```solidity
function principalDeposited(struct Tranche t) internal view returns (uint256)
```

### principalPaid

```solidity
function principalPaid(struct Tranche t) internal view returns (uint256)
```

Returns the amount of principal paid to the tranche

### principalReserved

```solidity
function principalReserved(struct Tranche t) internal view returns (uint256)
```

Returns the amount of principal paid to the tranche

### principalPaidAfterSettlement

```solidity
function principalPaidAfterSettlement(struct Tranche t) internal view returns (uint256)
```

Returns the amount of principal paid + principal reserved

### interestPaid

```solidity
function interestPaid(struct Tranche t) internal view returns (uint256)
```

### proportionalInterestAndPrincipalAvailableAfterReserves

```solidity
function proportionalInterestAndPrincipalAvailableAfterReserves(struct Tranche t, uint256 principalAmount, uint256 feePercent) internal view returns (uint256, uint256)
```

### proportionalInterestAndPrincipalAvailable

```solidity
function proportionalInterestAndPrincipalAvailable(struct Tranche t, uint256 principalAmount, uint256 feePercent) internal view returns (uint256, uint256)
```

### proportionalPrincipalAvailableAfterReserves

```solidity
function proportionalPrincipalAvailableAfterReserves(struct Tranche t, uint256 principalAmount) internal view returns (uint256)
```

### proportionalPrincipalWithdrawable

```solidity
function proportionalPrincipalWithdrawable(struct Tranche t, uint256 principalAmount) internal view returns (uint256)
```

### proportionalPrincipalOutstandingBeforeReserves

```solidity
function proportionalPrincipalOutstandingBeforeReserves(struct Tranche t, uint256 principalAmount) internal view returns (uint256)
```

### proportionalPrincipalOutstandingAfterReserves

```solidity
function proportionalPrincipalOutstandingAfterReserves(struct Tranche t, uint256 principalAmount) internal view returns (uint256)
```

### proportionalInterestWithdrawable

```solidity
function proportionalInterestWithdrawable(struct Tranche t, uint256 principalAmount, uint256 feePercent) internal view returns (uint256)
```

### drawdown

```solidity
function drawdown(struct Tranche t, uint256 principalAmount) internal
```

Only valid for Uncalled Tranche
Updates the tranche as the result of a drawdown


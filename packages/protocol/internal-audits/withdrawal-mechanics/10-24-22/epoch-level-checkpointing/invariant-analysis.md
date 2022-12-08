# Withdrawal Epoch Invariant Analsysis

Auditor: [Dalton](https://github.com/daltyboy11)

This section analyzes the invariants we rely upon for the correctness of epoch-level checkpointing and liquidation.

1. The senior pool's usdc available cannot exceed the pool's real usdc balance.

```
_usdcAvailable <= usdc.balanceOf(address(seniorPool))
```

2. The start time of the next epoch should be the end time of the previous epoch.

```
_epochs[i].endsAt - _epochDuration = epoch[i-1].endsAt
```

3. An epoch's fidu liquidated can't exceed it's fidu requested.

```
epoch.fiduLiquidated <= epoch.fiduRequested
```

4. An epoch's usdc allocated can't exceed its fiduRequested (in usdc terms, converted at the share price at the end of the epoch)

```
epoch.usdcAllocated <= _getUSDCAmountFromShares(epoch.fiduRequested)
```

5. An epoch's usdc allocated can't exceed the senior pool's usdc available.

```
epoch.usdcAllocated <= _usdcAvailable
```

## Invariant 1: `_usdcAvailable <= usdc.balanceOf(address(this))`

Assuming we set `usdcAvailable = usdc.balanceOf(address(this))` during epoch initialization, then the invariant will be preserved if the following conditions hold

1. If `usdcAvailable` decreases by X then `usdcBalance` decreases by X.
2. If `usdcBalance` decreases by X then `usdcAvailable` decreases by X.
3. If `usdcAvailable` increases by X then `usdcBalance` increases by X.
4. If `usdcBalance` increases by X then `usdcAvailable` increases OR stays the same.

We'll start by looking at all the places where _usdcAvailable_ or _usdcBalance_ decrease (conditions 1 and 2)
and see if the invariant holds.

- _\_applyEpochCheckpoint(Epoch storage epoch)_

  `usdcAvailable` decreases by `epoch.usdcAllocated` and `usdcBalance` decreases by 0. Actually,
  `usdcBalance` decreasing by 0 isn't exactly true. Now that usdc has been allocated, over time
  each user that had fidu requested in this epoch can call _claimWithdrawalRequest_ and receive
  their pro-rata amount of `epoch.usdcAllocated`.

  Suppose we have `n` such users and let _totalClaimed(i)_ be the sum of the usdc that has left
  the contract after the first `i` users have claimed their fidu for that epoch. We will show
  that the maximum decrease to `usdcBalance` as a result of the checkpoint is `epoch.usdcAllocated`.

  The formula for _totalClaimed(i)_ is

  ```
    epoch.usdcAllocated * request[1].fiduRequested / epoch.fiduRequested + ... + epoch.usdcAllocated * request[i].fiduRequested / epoch.fiduRequested
  = epoch.usdcAllocated / epoch.fiduRequested * (request[1].fiduRequested + ... + request[i].fiduRequested)
  ```

  This leads to the following facts:

  1. `totalClaimed(0) = 0`
     ```
     Proof: totalClaimed(0)
      = epoch.usdcAllocated / epoch.fiduRequested * 0
      = 0
     ```
  2. `totalClaimed(n) = epoch.usdcAllocated`
     ```
     Proof: totalClaimed(n)
      = epoch.usdcAllocated / epoch.fiduRequested * (request.fiduRequested[1] + ... + request.fiduRequested[n])
      = epoch.usdcAllocated / epoch.fiduRequested * epoch.fiduRequested
      = epoch.usdcAllocated
     ```
  3. `if i > j then totalClaimed(i) > totalClaimed(j)`
     ```
     Proof: totalClaimed(i) - totalClaimed(j)
      = epoch.usdcAllocated / epoch.fiduRequested * (request.fiduRequested[1] + ... + request.fiduRequested[i]) - epoch.usdcAllocated / epoch.fiduRequested * (request.requested[1] + ... + request.fiduRequested[j])
      = epoch.usdcAllocated / epoch.fiduRequested * ((request.fiduRequested[1] + ... + request.fiduRequested[i]) - (request.fiduRequested[1] + ... + request.fiduRequested[j]))
      = epoch.usdcAllocated / epoch.fiduRequested * (request.fiduRequested[j+1] + ... + request.fiduRequested[i])
      > 0
      If totalClaimed(i) - totalClaimed(j) > 0 then totalClaimed(i) > totalClaimed(j)
     ```

  Now that we know `totalClaimed(i) <= epoch.usdcAllocated` for all i, the maximum reduction to `usdcBalance` is `epoch.usdcAllocated`, and it occurs
  after every user has claimed their withdrawal. Therefore when `usdcAvailable` decreases by `epoch.usdcAllocated` due to a checkpoint the maximum
  decrease to `usdcBalance` as a result of the checkpoint is `usdcAllocated`, so the invariant holds.

- _\_withdraw(uint256 usdcAmount)_

  `usdcAvailable` decreases by `usdcAmount` and so does `usdcBalance`, so the invariant holds.

- _invest(ITranchedPool pool)_

  `usdcAvailable` decreases by `amount` and so does `usdcAvailable`, so the invariant holds.

Now we'll look at all the places where usdcAvailable or usdcBalance increases.

- _\_collectInterestAndPrincipal(address from, uint256 interest, uint256 principal)_

  `usdcAvailable` increases by interest + principal redeemed and so does `usdcBalance`, so the invariant holds.

- _deposit(uint256 amount)_

  `usdcAvailable` increases by the deposit amount and so does `usdcBalance`, so the invariant holds.

- Direct usdc transfers to the senior pool

  `usdcAvailable` stays the same and `usdcBalance` increases by some positive amount X. If `_usdcAvailable <= usdc.balanceOf(address(this))`
  is true then `_usdcAvailable <= X + usdc.balanceOf(address(this))` is also true, so the invariant holds.

Having shown the invariant `_usdcAvailable <= usdc.balanceOf(address(this))` is preserved in all cases where
usdc available or the usdc balance of the pool increases, we can be reasonably confident in the correctness
of `usdcAvailable`'s accounting.

## Invariant 2: `_epochs[i].endsAt - _epochDuration = epoch[i-1].endsAt`

The next epoch's endsAt is calculated and set in _\_initializeNextEpochFrom_ by:

```
nextEpoch.endsAt = previousEpoch.endsAt.add(_epochDuration);
```

Before the line above, previousEpoch's endsAt is **modified** via _\_mostRecentEndsAtAfter_. For the invariant to hold
it must be the case that

- The previous epoch's endsAt is not modified again after the nextEpoch's endsAt is set

If we look at _\_initializeNextEpochFrom_ and its callers' code, this is indeed the case - the previous epoch's `endsAt`
is not modified again after the next epoch's `endsAt` is set.

## Invariant 3: `epoch.fiduLiquidated <= epoch.fiduRequested`

Let's start with the liquidation logic

```
// finalize epoch
uint256 usdcNeededToFullyLiquidate = _getUSDCAmountFromShares(epoch.fiduRequested);
uint256 usdcAllocated = Math.min(_usdcAvailable, usdcNeededToFullyLiquidate);
uint256 fiduLiquidated = getNumShares(usdcAllocated);
```

**Case 1**: `usdcAllocated = usdcNeededToFullyLiquidate`

```
fiduLiquidated = getNumShares(usdcAllocated)
               = getNumShares(usdcNeededToFullyLiquidate)
               = getNumShares(_getUSDCAmountFromShares(epoch.fiduRequested))
```

Is getNumShares(\_getUSDCAmountFromShares(epoch.fiduRequested)) <= epoch.fiduRequested? We will prove
the affirmative by showing for all X that `getNumShares(_getUSDCAmountFromShares(X)) <= X` for all `X`

```
Proof:
  getNumShares(_getUSDCAmountFromShares(X)) =
  getNumShares(_getUSDCAmountFromShares(X, sharePrice)) =
  getNumShares(_fiduToUsdc(X * sharePrice) / FIDU_MANTISSA) =
  getNumShares(X * sharePrice / (FIDU_MANTISSA / USDC_MANTISSA) / FIDU_MANTISSA) =
  _getNumShares(X * sharePrice / (FIDU_MANTISSA / USDC_MANTISSA) / FIDU_MANTISSA, sharePrice) =
  _usdcToFidu(X * sharePrice / (FIDU_MANTISSA / USDC_MANTISSA) / FIDU_MANTISSA) * FIDU_MANTISSA / sharePrice =
  X * sharePrice / (FIDU_MANTISSA / USDC_MANTISSA) / FIDU_MANTISSA * FIDU_MANTISSA / USDC_MANTISSA * FIDU_MANTISSA / sharePrice =
  X

```

We have equality if fidu can be converted to usdc without truncating non-zero decimals in the fidu representation, but this is not
always the case. Take an example where the fidu amount is 1000000999999999999 and the share price is 1000000000000000000. Then

```
getNumShares(_getUSDCamountFromShares(1000000999999999999)) =
getNumShares(1000000) =
1000000000000000000
```

999999999999 fidu was lost in the conversion. Twelve 9's is the largest fidu amount that can be lost in conversion because fidu has
twelve more decimals than usdc.

Using the facts above we have

```
fiduLiquidated = getNumShares(_getUsdcAmountFromShares(epoch.fiduRequested))
getNumShares(_getUsdcAmountFromShares(epoch.fiduRequested)) <= epoch.fiduRequested

Therefore
fiduLiquidated <= epoch.fiduRequested
```

**Case 2**: `usdcAllocated = _usdcAvailable`

```
fiduLiquidated = getNumShares(usdcAllocated)
               = getNumShares(_usdcAvailable)
```

If `usdcAllocated == _usdcAvailable` then `_usdcAvailable <= usdcNeededToFullyLiquidate` because we take the min of the two.

If `_usdcAvailable <= usdcNeededToFullyLiquidate` then `getNumShares(_usdcAvailable) <= getNumShares(usdcNeededToFullyLiquidate)`.

We have already shown in Case 1 that when `fiduLiquidated_1 = getNumShares(usdcNeededToFullyLiquidate)` then `fiduLiquidated_1 <= epoch.fiduRequested`.
It follows that:

```
==> fiduLiquidated_2 = getNumShares(_usdcAvailable) <= getNumShares(usdcNeededToFullyLiquidate)
==> fiduLiquidated_2 <= fiduLiquidated_1
==> fiduLiquidated_2 <= epoch.fiduRequested
```

The invariant holds in cases 1 and 2 and these are the only cases, so the invariant holds in all cases.

## Invariant 4: `epoch.usdcAllocated <= _getUSDCAmountFromShares(epoch.fiduRequested)`

We will apply a similar technique to the one used for Invariant 3. The epoch's usdc allocated is

```
uint256 usdcAllocated = Math.min(_usdcAvailable, usdcNeededToFullyLiquidate);
```

**Case 1**: `usdcAllocated = usdcNeededToFullyLiquidate`

```
usdcAllocated = usdcNeededToFullyLiquidate
              = _getUSDCAmountFromShares(epoch.fiduRequested)
              <= _getUSDCAmountFromShares(epoch.fiduRequested)
```

This satisfies the invariant

**Case 2**: `usdcAllocated = _usdcAvailable`
We already established in Case 2 of Invariant 3 that if `usdcAllocated = _usdcAvailable`
then `usdcAllocated <= _getUSDCAmountFromShares(epoch.fiduRequested)`. This satisfies the invariant

## Invariant 5: `epoch.usdcAllocated <= _usdcAvailable`

The line

```
uint256 usdcAllocated = Math.min(_usdcAvailable, usdcNeededToFullyLiquidate);
```

ensures that the usdc allocated never exceeds the \_usdcAvailable, so the invariant holds.

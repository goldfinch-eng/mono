# Potential errors caused by integer division and rounding

Auditor: [Dalton](https://github.com/daltyboy11)

This section covers loss of information due to integer divisions. There are no serious errors here,
only considerations. The goal is to set expectations and not have us surprised when we see real
numbers not exactly matching their "expected" values.

## Action Items

No action necessary

## Imprecise FIDU => USDC conversions for epoch liquidation

If a fidu amount has non-zero digits in its 12 trailing decimals then that information is lost
when converting it to usdc. Examples:

```
1000000999999999999 fidu => 1000000 usdc (999999999999 fidu lost due to rounding)
1000000099590113020 fidu => 1000000 usdc (99590113020 fidu lost due to rounding)
```

We incur this loss during epoch liquidation. Consider when epoch.fiduRequested = 1000000999999999999,
the share price is 1000000000000000000, and \_usdcAvailable = 1000000.

```
// Epoch liquidation logic
uint256 usdcNeededToFullyLiquidate = _getUSDCAmountFromShares(epoch.fiduRequested);
uint256 usdcAllocated = Math.min(_usdcAvailable, usdcNeededToFullyLiquidate);
uint256 fiduLiquidated = getNumShares(usdcAllocated);

// Next epoch initialization logic
uint256 fiduToCarryOverFromLastEpoch = previousEpoch.fiduRequested - previousEpoch.fiduLiquidated;
```

Then usdcNeededToFullyLiquidate = \_getUSDCAmountFromShares(1000000999999999999) = 1000000. We have enough
usdcAllocated to "fully liquidate" and fiduLiquidated = getNumShares(1000000) = 1000000000000000000. The
fidu carried over to the next epoch is 1000000999999999999 - 1000000000000000000 = 999999999999, which has
a usdc value of 0 at the current share price.

### Impact

Is this a problem? Aesthetically, yes. Unless the fiduRequested for an epoch
can be converted to usdc without any rounding errors (extremely unlikely), then the fidu carried over to the
next epoch will always be non-zero, even if the pool has enough usdc available to fully liquidate the epoch.

What about in terms of correctness? We know the maximum amount of fidu (aka sharesOutstanding) that can linger
when \_usdcAvailable (aka assets) decreases by epoch.usdcAllocated is 999999999999. This is fine for now because
based on the current share price, 999999999999 fidu = 0 usdc. But if the share price increased sufficiently,
999999999999 fidu could become a non-zero liability in usdc terms. If it increased even further then it could become
a non-zero usdc liability that exceeds the asset <=> liability mismatch threshold.

The threshold is 1e6. What share price is necessary such that the usdc equivalent of 999999999999 shares exceeds the
threshold?

```
==> getUSDCAmountFromShares(999999999999) > 1e6
==> _getUSDCAmountFromShares(999999999999, sharePrice) > 1e6
==> _fiduToUsdc(999999999999 * sharePrice) / FIDU_MANTISSA
==> 999999999999 * sharePrice / (FIDU_MANTISSA / USDC_MANTISSA) / FIDU_MANTISSA
==> (999999999999 * sharePrice) * USDC_MANTISSA  / FIDU_MANTISSA^2 > 1e6
==> (999999999999 * sharePrice) * 1e6 / 1e36 > 1e6
==> 999999999999 * sharePrice > 1e36
==> sharePrice > 1e36 / 999999999999
By approximating 999999999999 ~= 1e12
==> sharePrice > 1e36 / 1e12
==> sharePrice > 1e24
```

The share price would have to increase by 6 orders of magnitude for the lingering fidu to exceed the
asset <=> liability mismatch threshold. This is impractical.

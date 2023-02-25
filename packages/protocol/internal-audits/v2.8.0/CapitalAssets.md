# CapitalAssets

CapitalAssets.sol audit

# Summary

No issues found

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference.

## External view Functions

### `getSupportedType`

- [x] Returns invalid if an invalid contract is passed

#### External calls

- [`StakedFiduAsset.isType`](./StakedFiduAsset.md#istype)
- [`PoolTokenAsset.isType`](./PoolTokenAsset.md#istype)

### `isValid`

- [x] Returns false if an invalid contract is passed

#### External calls

- [`StakedFiduAsset.isType`](./StakedFiduAsset.md#istype)
- [`StakedFiduAsset.isValid`](./StakedFiduAsset.md#isvalid)
- [`PoolTokenAsset.isType`](./PoolTokenAsset.md#istype)
- [`PoolTokenAsset.isValid`](./PoolTokenAsset.md#isvalid)

### `getUsdcEquivalent`

Proxies calls

#### External calls

- [`StakedFiduAsset.getUsdcEquivalent`](./StakedFiduAsset.md#getusdcequivalent)
- [`PoolTokenAsset.getUsdcEquivalent`](./PoolTokenAsset.md#getusdcequivalent)

## Issues

None.

# Capital Ledger Audit

CapitalLedger.sol audit

# Summary

- _tokenByIndex_ off-by-one error

  - **Severity**: 🟡 Medium
  - **Description**: The first valid position id is 1. The token at position 0 should be 1 and the token at position i should be i + 1.
  - **Suggested Fix**: We should return `index + 1` instead of `index`
  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

- Methods to fetch a position should revert if a position doesn't exist

  - **Severity**: 🟢 Informational
  - **Description**: It would make sense for the method to revert entirely
    if a position doesn't exist. That way the caller doesn't need to validate
    that a position actually exists.
  - **Suggested Fix**: Add an internal helper method like this

    ```solidity
    function _getPosition(uint positionId) internal returns (Position storage) {
      Position storage p = positions[positionId];

      bool positionExists = /* do some validation here */;
      if (!positionExists  {
        revert PositionDoesNotExist();
      }

      return p;
    }
    ```

    and use it throughout the contract

  - **Commit**: [5495ee0](https://github.com/warbler-labs/mono/pull/1069/commits/5495ee01daa5e24b86a32a3be2dea71c5b83db61)

# Appendix

Auditor's notes. Not intended to be understood by readers but kept for reference.

## External Functions

### `constructor`

No initialization needed.

### `depositERC721`

- [x] onlyOperator
- ℹ️ Does not take into account capital appreciation or depreciation. This means
  that regardless of how much the value of a vaulted asset changes, the benefit to
  membership score will remain constant until the asset is withdraw and
  re-deposited.

#### External Calls

- [`CapitalAssets.getSupportedType`](./CapitalAssets.md#getsupportedtype) **library**
- [`CapitalAssets.isValid`](./CapitalAssets.md#isvalid) **library**
- [`CapitalAssets.getUsdcEquivalent`](./CapitalAssets.md#getusdcequivalent) **library**

### `withdraw`

- [x] onlyOperator

## External View Functions

### `totalsOf`

### `assetAddressOf`

- ℹ️ can be changed to external
- 🚑 Consider making this revert if a position doesnt exist

### `erc721IdOf`

- ℹ️ can be changed to external
- 🚑 Consider making this revert if a position doesnt exist

### `ownerOf`

- ℹ️ can be changed to external
- 🚑 Consider making this revert if a position doesnt exist

### `totalsOf`

### `totalSupply`

- ℹ️ can be changed to external
- 🚑 When withdrawing a position, the position is effectively burned which should decrease the total supply

### `tokenOfOwnerByIndex`

### `tokenByIndex`

- 🚑 Consider making this revert if a position doesnt exist

### `onERC721Received`

Inert

## Issues

- 🚑 For a number of methods that fetch a position, it would make sense for the
- method to revert entirely if a position doesn't exist. That way the caller
  doesn't need to validate that a position actually exists. To make this easier
  I would suggest adding an internal helper method like this

  ```solidity
  function _getPosition(uint positionId) internal returns (Position storage) {
    Position storage p = positions[positionId];

    bool positionExists = /* do some validation here */;
    if (!positionExists  {
      revert PositionDoesNotExist();
    }

    return p;
  }
  ```

  and use it throughout the contract

# CapitalLedger

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

* ℹ️ can be changed to external
* 🚑 Consider making this revert if a position doesnt exist

### `erc721IdOf`

* ℹ️ can be changed to external
* 🚑 Consider making this revert if a position doesnt exist

### `ownerOf`

* ℹ️ can be changed to external
* 🚑 Consider making this revert if a position doesnt exist

### `totalsOf`

### `totalSupply`

* ℹ️ can be changed to external
* 🚑 When withdrawing a position, the position is effectively burned which should decrease the total supply

### `tokenOfOwnerByIndex`

### `tokenByIndex`
* 🚑 Consider making this revert if a position doesnt exist

### `onERC721Received`
Inert


## Issues
* 🚑 For a number of methods that fetch a position, it would make sense for the
* method to revert entirely if a position doesn't exist. That way the caller
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
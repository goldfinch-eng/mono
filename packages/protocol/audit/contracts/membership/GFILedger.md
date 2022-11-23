# GFI Ledger

## External Functions

### `deposit`
- [x] onlyOperator
- [x] transfers GFI
- [x] creates a position
### `withdraw`
- [x] onlyOperator
- [x] transfer GFI to owner
- [x] deletes position when fully withdrawing
- [x] does not delete the position when partially withdrawing

### External View Functions

### `balanceOf`

### `totalsOf`

### `positions`
* 🚑 Consider making this revert if a position doesnt exist


### `ownerOf`
* 🚑 Consider making this revert if a position doesnt exist

calls

## Issues
* 🚑 For a number of methods that fetch a position, it would make sense for the
  method to revert entirely if a position doesn't exist. That way the caller
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

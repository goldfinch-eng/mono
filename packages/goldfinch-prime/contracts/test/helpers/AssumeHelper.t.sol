// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

library AssumeHelper {
  function canAdd(uint x, uint y) public view returns (bool) {
    uint z;
    unchecked {
      z = x + y;
    }
    return z > y;
  }
}

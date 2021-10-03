// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../protocol/core/UniqueIdentity.sol";

contract TestUniqueIdentity is UniqueIdentity {
  function _mintForTest(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) public onlyAdmin incrementNonce(to) {
    _mint(to, id, amount, data);
  }
}

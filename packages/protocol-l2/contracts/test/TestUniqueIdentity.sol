// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {UniqueIdentity} from "../protocol/core/UniqueIdentity.sol";

contract TestUniqueIdentity is UniqueIdentity {
  function _mintForTest(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) public incrementNonce(to) {
    _mint(to, id, amount, data);
  }

  function _burnForTest(address account, uint256 id) public incrementNonce(account) {
    _burn(account, id, 1);
  }
}

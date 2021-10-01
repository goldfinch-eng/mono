// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../protocol/core/GoldfinchIdentity.sol";

contract TestGoldfinchIdentity is GoldfinchIdentity {
  function _mintForTest(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) public onlyAdmin {
    nonces[to] += 1;
    _mint(to, id, amount, data);
  }

  function isAdmin() public view returns (bool) {
    return hasRole(OWNER_ROLE, _msgSender());
  }

  modifier onlyAdmin() {
    require(isAdmin(), "Must have admin role to perform this action");
    _;
  }
}

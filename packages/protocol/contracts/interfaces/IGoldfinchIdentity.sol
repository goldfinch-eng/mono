// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

interface IGoldfinchIdentity is IERC1155Upgradeable {
  function mint(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory signature
  ) external payable;

  function burn(
    address account,
    uint256 id,
    uint256 value,
    bytes memory signature
  ) external;
}

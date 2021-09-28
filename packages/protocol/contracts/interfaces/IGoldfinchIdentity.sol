// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

interface IGoldfinchIdentity is IERC1155Upgradeable {
  function mint(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data,
    bytes memory signature
  ) external;

  function mintBatch(
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data,
    bytes memory signature
  ) external;

  function burn(
    address account,
    uint256 id,
    uint256 value,
    bytes memory signature
  ) external;

  function burnBatch(
    address account,
    uint256[] memory ids,
    uint256[] memory values,
    bytes memory signature
  ) external;
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IERC20withDec.sol";

interface IFidu is IERC20withDec {
  function mintTo(address to, uint256 amount) external;

  function burnFrom(address to, uint256 amount) external;
}

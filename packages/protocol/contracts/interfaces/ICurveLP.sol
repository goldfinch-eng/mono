// SPDX-License-Identifier: MIT
// Taken from https://github.com/compound-finance/compound-protocol/blob/master/contracts/CTokenInterfaces.sol
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IERC20withDec.sol";

abstract contract ICurveLP is IERC20withDec {
  function getVirtualPrice() external view virtual returns (uint256);
}

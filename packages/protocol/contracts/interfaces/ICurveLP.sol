// SPDX-License-Identifier: MIT
// Taken from https://github.com/compound-finance/compound-protocol/blob/master/contracts/CTokenInterfaces.sol
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IERC20withDec.sol";

interface ICurveLP is IERC20withDec {
  /*** User Interface ***/

  function getVirtualPrice() external pure returns (uint256);
}

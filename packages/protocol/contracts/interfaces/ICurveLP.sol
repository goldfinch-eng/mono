// SPDX-License-Identifier: MIT
// Taken from https://github.com/compound-finance/compound-protocol/blob/master/contracts/CTokenInterfaces.sol
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IERC20withDec.sol";

abstract contract ICurveLP is IERC20withDec {
  function getVirtualPrice() external view virtual returns (uint256);

  function calcTokenAmount(uint256[2] calldata amounts, bool isDeposit) external view virtual returns (uint256);

  function addLiquidity(
    uint256[2] calldata amounts,
    uint256 minMintAmount,
    address receiver
  ) external virtual returns (uint256);
}

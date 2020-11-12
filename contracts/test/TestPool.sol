// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../protocol/Pool.sol";

contract TestPool is Pool {
  function _getNumShares(uint256 amount) public view returns (uint256) {
    return getNumShares(amount);
  }

  function _usdcMantissa() public view returns (uint256) {
    return usdcMantissa();
  }

  function _fiduMantissa() public view returns (uint256) {
    return fiduMantissa();
  }

  function _usdcToFidu(uint256 amount) public view returns (uint256) {
    return usdcToFidu(amount);
  }

  function _setSharePrice(uint256 newSharePrice) public returns (uint256) {
    sharePrice = newSharePrice;
  }
}

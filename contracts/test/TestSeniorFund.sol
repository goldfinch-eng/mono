// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../protocol/core/SeniorFund.sol";

contract TestSeniorFund is SeniorFund {
  function _getNumShares(uint256 amount) public view returns (uint256) {
    return getNumShares(amount);
  }

  function _usdcMantissa() public pure returns (uint256) {
    return usdcMantissa();
  }

  function _fiduMantissa() public pure returns (uint256) {
    return fiduMantissa();
  }

  function _usdcToFidu(uint256 amount) public pure returns (uint256) {
    return usdcToFidu(amount);
  }

  function _setSharePrice(uint256 newSharePrice) public returns (uint256) {
    sharePrice = newSharePrice;
  }
}

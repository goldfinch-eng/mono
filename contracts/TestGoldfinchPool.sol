// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./GoldfinchPool.sol";

contract TestGoldfinchPool is GoldfinchPool {
    function _getNumShares(uint amount, uint multiplier, uint price) pure public returns (uint) {
      return getNumShares(amount, multiplier, price);
    }
}

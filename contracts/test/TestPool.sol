// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../Pool.sol";

contract TestPool is Pool {
    function _getNumShares(
        uint256 amount,
        uint256 multiplier,
        uint256 price
    ) public pure returns (uint256) {
        return getNumShares(amount, multiplier, price);
    }
}

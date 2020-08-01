// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GoldfinchPool is Ownable {
    using SafeMath for uint256;
    uint public sharePrice = 1e18;
    uint mantissa = 1e18;
    uint public totalShares;
    mapping(address => uint) public capitalProviders;

    function deposit() external payable {
      uint shares = capitalProviders[msg.sender];
      uint newShares = getNumShares(msg.value, mantissa, sharePrice);
      totalShares = totalShares.add(newShares);
      capitalProviders[msg.sender] = shares.add(newShares);
    }

    function getNumShares(uint amount, uint multiplier, uint price) pure internal returns (uint) {
      return amount.mul(multiplier).div(price);
    }
}

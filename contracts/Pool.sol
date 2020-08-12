// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@nomiclabs/buidler/console.sol";

contract Pool is Ownable {
  using SafeMath for uint256;
  uint public sharePrice = 1e18;
  uint mantissa = 1e18;
  uint public totalShares;
  mapping(address => uint) public capitalProviders;

  function deposit() external payable {
    // Determine current shares the address has, and the amount of new shares to be added
    uint currentShares = capitalProviders[msg.sender];
    uint depositShares = getNumShares(msg.value, mantissa, sharePrice);

    // Add the new shares to both the pool and the address
    totalShares = totalShares.add(depositShares);
    capitalProviders[msg.sender] = currentShares.add(depositShares);
  }

  function withdraw(uint amount) external {
    // Determine current shares the address has and the shares requested to withdraw
    uint currentShares = capitalProviders[msg.sender];
    uint withdrawShares = getNumShares(amount, mantissa, sharePrice);

    // Ensure the address has enough value in the pool
    require(withdrawShares <= currentShares, "Amount requested is greater than the amount owned for this address");

    // Remove the new shares from both the pool and the address
    totalShares = totalShares.sub(withdrawShares);
    capitalProviders[msg.sender] = currentShares.sub(withdrawShares);

    // Send the amount to the address
    Address.sendValue(msg.sender, amount);
  }

  function receiveInterestRepayment() external payable onlyOwner {
    uint increment = msg.value.mul(mantissa).div(totalShares);
    sharePrice = sharePrice + increment;
  }

  function receivePrincipalRepayment() external payable onlyOwner {
    // Purposefully does nothing. No share price updates.
  }

  function transferFunds(address payable recipient, uint amount) public payable onlyOwner returns (bool) {
    Address.sendValue(recipient, amount);
  }

  function getNumShares(uint amount, uint multiplier, uint price) internal pure returns (uint) {
    return amount.mul(multiplier).div(price);
  }
}

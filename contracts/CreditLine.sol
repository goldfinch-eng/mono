// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './Pool.sol';
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

// TODO: This should be upgradable!
contract CreditLine is Ownable {
  address public borrower;
  uint public collateral;
  uint public limit;
  uint public interestApr;
  uint public minCollateralPercent;
  uint public paymentPeriodInDays;
  uint public termInDays;
  uint public balance;
  uint public interestOwed;
  uint public principalOwed;
  uint public prepaidBalance;
  uint public termEndBlock;
  uint public nextDueBlock;
  uint public lastUpdatedBlock;

  constructor(
    address _borrower,
    uint _limit,
    uint _interestApr,
    uint _minCollateralPercent,
    uint _paymentPeriodInDays,
    uint _termInDays
  ) public {
    borrower = _borrower;
    limit = _limit;
    interestApr = _interestApr;
    minCollateralPercent = _minCollateralPercent;
    paymentPeriodInDays = _paymentPeriodInDays;
    termInDays = _termInDays;
    lastUpdatedBlock = block.number;
  }

  function setTermEndBlock(uint newTermEndBlock) public onlyOwner returns (uint) {
    return termEndBlock = newTermEndBlock;
  }

  function setBalance(uint newBalance) public onlyOwner returns (uint) {
    return balance = newBalance;
  }

  function setInterestOwed(uint newInterestOwed) public onlyOwner returns (uint) {
    return interestOwed = newInterestOwed;
  }

  function setPrincipalOwed(uint newPrincipalOwed) public onlyOwner returns (uint) {
    return principalOwed = newPrincipalOwed;
  }

  function setLastUpdatedBlock(uint newLastUpdatedBlock) public onlyOwner returns (uint) {
    return lastUpdatedBlock = newLastUpdatedBlock;
  }
}
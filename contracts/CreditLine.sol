// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "./Pool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// TODO: This should be upgradable!
contract CreditLine is Ownable {
  // Credit line terms
  address public borrower;
  uint public collateral;
  uint public limit;
  uint public interestApr;
  uint public minCollateralPercent;
  uint public paymentPeriodInDays;
  uint public termInDays;

  // Accounting variables
  uint public balance;
  uint public interestOwed;
  uint public principalOwed;
  uint public prepaymentBalance;
  uint public collateralBalance;
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

  function setTermEndBlock(uint newTermEndBlock) external onlyOwner returns (uint) {
    return termEndBlock = newTermEndBlock;
  }

  function setNextDueBlock(uint newNextDueBlock) external onlyOwner returns (uint) {
    return nextDueBlock = newNextDueBlock;
  }

  function setBalance(uint newBalance) external onlyOwner returns(uint) {
    return balance = newBalance;
  }

  function setInterestOwed(uint newInterestOwed) external onlyOwner returns (uint) {
    return interestOwed = newInterestOwed;
  }

  function setPrincipalOwed(uint newPrincipalOwed) external onlyOwner returns (uint) {
    return principalOwed = newPrincipalOwed;
  }

  function setPrepaymentBalance(uint newPrepaymentBalance) external onlyOwner returns (uint) {
    return prepaymentBalance = newPrepaymentBalance;
  }

  function setLastUpdatedBlock(uint newLastUpdatedBlock) external onlyOwner returns (uint) {
    return lastUpdatedBlock = newLastUpdatedBlock;
  }

  function sendInterestToPool(uint interestPayment, address payable poolAddress) external onlyOwner returns(uint) {
    Pool(poolAddress).receiveInterestRepayment{value: interestPayment}();
    return interestPayment;
  }

  function sendPrincipalToPool(uint principalPayment, address payable poolAddress) external onlyOwner returns(uint) {
    Pool(poolAddress).receivePrincipalRepayment{value: principalPayment}();
    return principalPayment;
  }

  function receiveCollateral() external payable onlyOwner returns (uint) {
    return collateralBalance = collateralBalance + msg.value;
  }

  function receivePrepayment() external payable onlyOwner returns (uint) {
    return prepaymentBalance = prepaymentBalance + msg.value;
  }
}

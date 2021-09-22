// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

abstract contract IV1CreditLine {
  address public borrower;
  address public underwriter;
  uint256 public limit;
  uint256 public interestApr;
  uint256 public paymentPeriodInDays;
  uint256 public termInDays;
  uint256 public lateFeeApr;

  uint256 public balance;
  uint256 public interestOwed;
  uint256 public principalOwed;
  uint256 public termEndBlock;
  uint256 public nextDueBlock;
  uint256 public interestAccruedAsOfBlock;
  uint256 public writedownAmount;
  uint256 public lastFullPaymentBlock;

  function setLimit(uint256 newAmount) external virtual;

  function setBalance(uint256 newBalance) external virtual;
}

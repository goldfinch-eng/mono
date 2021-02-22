// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../protocol/Pool.sol";
import "../protocol/BaseUpgradeablePausable.sol";

contract FakeV2CreditLine is BaseUpgradeablePausable {
  // Credit line terms
  address public borrower;
  address public underwriter;
  uint256 public limit;
  uint256 public interestApr;
  uint256 public paymentPeriodInDays;
  uint256 public termInDays;
  uint256 public lateFeeApr;

  // Accounting variables
  uint256 public balance;
  uint256 public interestOwed;
  uint256 public principalOwed;
  uint256 public termEndBlock;
  uint256 public nextDueBlock;
  uint256 public interestAccruedAsOfBlock;
  uint256 public writedownAmount;
  uint256 public lastFullPaymentBlock;

  function initialize(
    address owner,
    address _borrower,
    address _underwriter,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) public initializer {
    __BaseUpgradeablePausable__init(owner);
    borrower = _borrower;
    underwriter = _underwriter;
    limit = _limit;
    interestApr = _interestApr;
    paymentPeriodInDays = _paymentPeriodInDays;
    termInDays = _termInDays;
    lateFeeApr = _lateFeeApr;
    interestAccruedAsOfBlock = block.number;
  }

  function anotherNewFunction() external pure returns (uint256) {
    return 42;
  }

  function authorizePool(address) external view onlyAdmin {
    // no-op
    return;
  }
}

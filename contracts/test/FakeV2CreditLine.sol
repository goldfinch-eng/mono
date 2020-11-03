// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "../protocol/Pool.sol";
import "../protocol/BaseUpgradeablePausable.sol";

contract FakeV2CreditLine is BaseUpgradeablePausable {
  // Credit line terms
  address public borrower;
  address public underwriter;
  uint256 public collateral;
  uint256 public limit;
  uint256 public interestApr;
  uint256 public minCollateralPercent;
  uint256 public paymentPeriodInDays;
  uint256 public termInDays;

  // Accounting variables
  uint256 public balance;
  uint256 public interestOwed;
  uint256 public principalOwed;
  uint256 public collectedPaymentBalance;
  uint256 public collateralBalance;
  uint256 public termEndBlock;
  uint256 public nextDueBlock;
  uint256 public lastUpdatedBlock;

  function initialize(
    address owner,
    address _borrower,
    address _underwriter,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _minCollateralPercent,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays
  ) public initializer {
    __BaseUpgradeablePausable__init(owner);
    borrower = _borrower;
    underwriter = _underwriter;
    limit = _limit;
    interestApr = _interestApr;
    minCollateralPercent = _minCollateralPercent;
    paymentPeriodInDays = _paymentPeriodInDays;
    termInDays = _termInDays;
    lastUpdatedBlock = block.number;
  }

  function anotherNewFunction() external pure returns (uint256) {
    return 42;
  }

  function authorizePool(address) external view onlyAdmin {
    // no-op
    return;
  }
}

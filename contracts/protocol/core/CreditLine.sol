// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "../../interfaces/IERC20withDec.sol";

/**
 * @title CreditLine
 * @notice A "dumb" state container that represents the agreement between an Underwriter and
 *  the borrower. Includes the terms of the loan, as well as the current accounting state, such as interest owed.
 *  This contract purposefully has essentially no business logic. Really just setters and getters.
 * @author Goldfinch
 */

// solhint-disable-next-line max-states-count
contract CreditLine is BaseUpgradeablePausable {
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
    require(owner != address(0) && _borrower != address(0) && _underwriter != address(0), "Zero address passed in");
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

  function setTermEndBlock(uint256 newTermEndBlock) external onlyAdmin {
    termEndBlock = newTermEndBlock;
  }

  function setNextDueBlock(uint256 newNextDueBlock) external onlyAdmin {
    nextDueBlock = newNextDueBlock;
  }

  function setBalance(uint256 newBalance) external onlyAdmin {
    balance = newBalance;
  }

  function setInterestOwed(uint256 newInterestOwed) external onlyAdmin {
    interestOwed = newInterestOwed;
  }

  function setPrincipalOwed(uint256 newPrincipalOwed) external onlyAdmin {
    principalOwed = newPrincipalOwed;
  }

  function setInterestAccruedAsOfBlock(uint256 newInterestAccruedAsOfBlock) external onlyAdmin {
    interestAccruedAsOfBlock = newInterestAccruedAsOfBlock;
  }

  function setWritedownAmount(uint256 newWritedownAmount) external onlyAdmin {
    writedownAmount = newWritedownAmount;
  }

  function setLastFullPaymentBlock(uint256 newLastFullPaymentBlock) external onlyAdmin {
    lastFullPaymentBlock = newLastFullPaymentBlock;
  }

  function setLateFeeApr(uint256 newLateFeeApr) external onlyAdmin {
    lateFeeApr = newLateFeeApr;
  }

  function setLimit(uint256 newAmount) external onlyAdminOrUnderwriter {
    limit = newAmount;
  }

  function authorizePool(address configAddress) external onlyAdmin {
    GoldfinchConfig config = GoldfinchConfig(configAddress);
    address poolAddress = config.getAddress(uint256(ConfigOptions.Addresses.Pool));
    address usdcAddress = config.getAddress(uint256(ConfigOptions.Addresses.USDC));
    // Approve the pool for an infinite amount
    bool success = IERC20withDec(usdcAddress).approve(poolAddress, uint256(-1));
    require(success, "Failed to approve USDC");
  }

  modifier onlyAdminOrUnderwriter() {
    require(isAdmin() || _msgSender() == underwriter, "Restricted to owner or underwriter");
    _;
  }
}

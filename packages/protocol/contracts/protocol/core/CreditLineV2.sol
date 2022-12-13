// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {SafeMath} from "../../library/SafeMath.sol";
import {GoldfinchConfig} from "./GoldfinchConfig.sol";
import {ConfigHelper} from "./ConfigHelper.sol";
import {BaseUpgradeablePausable} from "./BaseUpgradeablePausable.sol";
import {Accountant} from "./Accountant.sol";
import {IERC20withDec} from "../../interfaces/IERC20withDec.sol";
import {IV2TranchedPool} from "../../interfaces/IV2TranchedPool.sol";
import {IV3CreditLine} from "../../interfaces/IV3CreditLine.sol";

/**
 * @title CreditLineV2
 * @notice A contract that represents the agreement between Backers and
 *  a Borrower. Includes the terms of the loan, as well as the accounting state such as interest owed.
 *  A CreditLineV2 instance belongs to a TranchedPoolV2 instance and is fully controlled by that TranchedPoolV2
 *  instance. It should not operate in any standalone capacity and should generally be considered internal
 *  to the TranchedPoolV2 instance.
 * @author Warbler Labs
 */

// solhint-disable-next-line max-states-count
contract CreditLineV2 is BaseUpgradeablePausable, IV3CreditLine {
  using ConfigHelper for GoldfinchConfig;

  uint256 private constant SECONDS_PER_DAY = 60 * 60 * 24;

  GoldfinchConfig public config;

  // Credit line terms
  address public override borrower;
  uint256 public currentLimit;
  uint256 public override maxLimit;
  uint256 public override interestApr;
  uint256 public override paymentPeriodInDays;
  uint256 public override termInDays;
  uint256 public override principalGracePeriodInDays;
  uint256 public override lateFeeApr;

  // Accounting variables
  uint256 public override balance;
  uint256 public override totalInterestPaid;
  uint256 public override termEndTime;
  uint256 public override lastFullPaymentTime;
  // End of the current payment period. Any principal or interest
  // acrruing in the current period becomes owed at this time.
  uint256 internal _nextDueTime;
  // Cumulative interest up to checkpointedAsOf
  uint256 internal _totalInterestAccrued;
  // Cumulative interest owed, i.e. a snapshot of _totalInterestAccrued up to
  // the last due time
  uint256 internal _totalInterestOwed;
  // Principal owed up to checkpointedAsOf
  uint256 internal _principalOwed;
  // The last time `checkpoint()` was called
  uint256 internal _checkpointedAsOf;

  /// @inheritdoc IV3CreditLine
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _maxLimit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays
  ) public override initializer {
    require(
      _config != address(0) && owner != address(0) && _borrower != address(0),
      "Zero address passed in"
    );
    __BaseUpgradeablePausable__init(owner);
    config = GoldfinchConfig(_config);
    borrower = _borrower;
    maxLimit = _maxLimit;
    interestApr = _interestApr;
    paymentPeriodInDays = _paymentPeriodInDays;
    termInDays = _termInDays;
    lateFeeApr = _lateFeeApr;
    principalGracePeriodInDays = _principalGracePeriodInDays;
    _checkpointedAsOf = block.timestamp;

    // Unlock owner, which is a TranchedPool, for infinite amount
    bool success = config.getUSDC().approve(owner, uint256(-1));
    require(success, "Failed to approve USDC");
  }

  /// @inheritdoc IV3CreditLine
  /// @dev copy initializer
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _maxLimit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr,
    uint256 _principalGracePeriodInDays,
    IV3CreditLine other
  ) public override initializer {
    require(
      _config != address(0) && owner != address(0) && _borrower != address(0),
      "Zero address passed in"
    );
    __BaseUpgradeablePausable__init(owner);
    config = GoldfinchConfig(_config);

    borrower = _borrower;
    maxLimit = _maxLimit;
    interestApr = _interestApr;
    paymentPeriodInDays = _paymentPeriodInDays;
    termInDays = _termInDays;
    lateFeeApr = _lateFeeApr;
    principalGracePeriodInDays = _principalGracePeriodInDays;

    balance = other.balance();
    totalInterestPaid = other.totalInterestPaid();
    _totalInterestAccrued = other.totalInterestAccrued();
    _totalInterestOwed = other.totalInterestOwed();
    _principalOwed = other.principalOwed();
    termEndTime = other.termEndTime();
    _nextDueTime = calculateNextDueTime(block.timestamp);

    // Ther other cl's accounting variables are for the current timestamp so we should
    // set our checkpointedAsOf to the current timestamp
    _checkpointedAsOf = block.timestamp;
    lastFullPaymentTime = other.lastFullPaymentTime();
    currentLimit = other.limit();

    // Unlock owner, which is a TranchedPool, for infinite amount
    bool success = config.getUSDC().approve(owner, uint256(-1));
    require(success, "Failed to approve USDC");
  }

  function limit() external view override returns (uint256) {
    return currentLimit;
  }

  /// @inheritdoc IV3CreditLine
  function drawdown(uint256 amount) external override onlyAdmin {
    require(
      termEndTime == 0 || block.timestamp < termEndTime,
      "After termEndTime or uninitialized"
    );
    require(amount + balance <= currentLimit, "Cannot drawdown more than the limit");
    require(amount > 0, "Invalid drawdown amount");

    if (balance == 0) {
      lastFullPaymentTime = block.timestamp;
      if (termEndTime == 0) {
        termEndTime = block.timestamp.add(termInDays.mul(SECONDS_PER_DAY));
      }
    }

    // The balance is about to change.. checkpoint amounts owed!
    checkpoint();

    balance = balance.add(amount);
    require(!_isLate(block.timestamp), "Cannot drawdown when payments are past due");
  }

  /// @notice We keep this to conform to the ICreditLine interface, but it's redundant information
  ///   now that we have `checkpointedAsOf`
  function interestAccruedAsOf() public view virtual override returns (uint256) {
    return _checkpointedAsOf;
  }

  function setLimit(uint256 newAmount) external override onlyAdmin {
    require(newAmount <= maxLimit, "Cannot be more than the max limit");
    currentLimit = newAmount;
  }

  function setMaxLimit(uint256 newAmount) external override onlyAdmin {
    maxLimit = newAmount;
  }

  function termStartTime() external view override returns (uint256) {
    require(termEndTime > 0, "Uninitialized");
    return _termStartTime();
  }

  function isLate() external view override returns (bool) {
    return _isLate(block.timestamp);
  }

  function withinPrincipalGracePeriod() external view override returns (bool) {
    if (termEndTime == 0) {
      // Loan hasn't started yet
      return true;
    }
    return block.timestamp < _termStartTime().add(principalGracePeriodInDays.mul(SECONDS_PER_DAY));
  }

  /// @inheritdoc IV3CreditLine
  function close() external override onlyAdmin {
    balance = 0;
    currentLimit = 0;
    maxLimit = 0;
  }

  function interestOwed() public view virtual override returns (uint256) {
    return totalInterestOwed().saturatingSub(totalInterestPaid);
  }

  /// @inheritdoc IV3CreditLine
  function interestOwedAt(uint256 timestamp) public view override returns (uint256) {
    /// @dev IT: Invalid timestamp
    require(timestamp >= _checkpointedAsOf, "IT");
    return totalInterestOwedAt(timestamp).saturatingSub(totalInterestPaid);
  }

  function nextDueTime() public view override returns (uint256) {
    return calculateNextDueTime(block.timestamp);
  }

  /// @inheritdoc IV3CreditLine
  function totalInterestAccrued() public view override returns (uint256) {
    return totalInterestAccruedAt(block.timestamp);
  }

  /// @inheritdoc IV3CreditLine
  function totalInterestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    require(timestamp >= _checkpointedAsOf, "IT");
    return _totalInterestAccrued.add(interestAccruedOverPeriod(_checkpointedAsOf, timestamp));
  }

  /// @inheritdoc IV3CreditLine
  function totalInterestOwedAt(uint256 timestamp) public view override returns (uint256) {
    require(timestamp >= _checkpointedAsOf, "IT");
    // After loan maturity there is no concept of additional interest. All interest accrued
    // automatically beocmes interest owed.
    if (timestamp > termEndTime) {
      return totalInterestAccruedAt(timestamp);
    }

    // If we crossed a payment period then add all interest accrued between last checkpoint and
    // the most recent crossed period
    uint256 mostRecentDueTime = mostRecentLastDueTimeAt(timestamp);
    bool crossedPeriod = _checkpointedAsOf <= mostRecentDueTime && mostRecentDueTime <= timestamp;
    if (crossedPeriod) {
      return
        _totalInterestAccrued.add(interestAccruedOverPeriod(_checkpointedAsOf, mostRecentDueTime));
    } else {
      // Interest owed doesn't change within a payment period
      return _totalInterestOwed;
    }
  }

  /// @inheritdoc IV3CreditLine
  function totalInterestOwed() public view override returns (uint256) {
    return totalInterestOwedAt(block.timestamp);
  }

  /// @inheritdoc IV3CreditLine
  function interestAccrued() public view override returns (uint256) {
    return interestAccruedAt(block.timestamp);
  }

  function principalOwed() public view override returns (uint256) {
    return principalOwedAt(block.timestamp);
  }

  /// @inheritdoc IV3CreditLine
  function interestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    require(timestamp >= _checkpointedAsOf, "IT");
    return
      totalInterestAccruedAt(timestamp).sub(
        (Math.max(totalInterestPaid, totalInterestOwedAt(timestamp)))
      );
  }

  /// @inheritdoc IV3CreditLine
  function principalOwedAt(uint256 timestamp) public view override returns (uint256) {
    require(timestamp >= _checkpointedAsOf, "IT");
    uint256 accrued = Accountant.calculatePrincipalAccrued(
      this,
      balance,
      mostRecentLastDueTimeAt(timestamp)
    );
    return _principalOwed.add(accrued);
  }

  /// @dev Shortcut for calling the accounting to get interest accrued over an interval on the present balance
  function interestAccruedOverPeriod(uint256 start, uint256 end) internal view returns (uint256) {
    return
      Accountant.calculateInterestAccruedOverPeriod(
        this,
        balance,
        start,
        end,
        config.getLatenessGracePeriodInDays()
      );
  }

  /// @notice Updates accounting variables. This should be called before any changes to `balance`!
  function checkpoint() internal {
    _totalInterestOwed = totalInterestOwed();
    _totalInterestAccrued = totalInterestAccrued();
    _principalOwed = principalOwed();
    _nextDueTime = calculateNextDueTime(block.timestamp);
    _checkpointedAsOf = block.timestamp;
  }

  /// @inheritdoc IV3CreditLine
  function pay(
    uint256 paymentAmount
  ) public override onlyAdmin returns (IV2TranchedPool.PaymentAllocation memory) {
    // The balance might change.. checkpoint amounts owed!
    checkpoint();

    IV2TranchedPool.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      balance,
      interestOwed(),
      interestAccrued(),
      _principalOwed
    );

    // Update accounting vars
    uint256 newTotalInterestPaid = totalInterestPaid.add(pa.owedInterestPayment).add(
      pa.accruedInterestPayment
    );
    uint256 newPrincipalOwed = _principalOwed.sub(pa.principalPayment);
    uint256 newBalance = balance.sub(pa.principalPayment).sub(pa.additionalBalancePayment);
    totalInterestPaid = newTotalInterestPaid;
    _principalOwed = newPrincipalOwed;
    balance = newBalance;

    // If no new interest or principal owed than it was a full payment
    uint256 newInterestOwed = interestOwed();
    if (newInterestOwed == 0 && newPrincipalOwed == 0 && _nextDueTime != 0) {
      lastFullPaymentTime = mostRecentLastDueTimeAt(block.timestamp);
    }

    return pa;
  }

  /// @inheritdoc IV3CreditLine
  /// @dev II: insufficient interest
  function pay(
    uint256 principalPayment,
    uint256 interestPayment
  ) public override onlyAdmin returns (IV2TranchedPool.PaymentAllocation memory) {
    // The balance might change here.. Checkpoint amounts owed!
    checkpoint();

    // You must pay off all interest before paying off any principal, therefore we reject a payment
    // if your principalAmount is non-zero and your interestAmount is insufficient to cover
    // obligated + additional interest.
    bool isFullInterestPayment = interestPayment >= interestOwed().add(interestAccrued());
    require(principalPayment == 0 || isFullInterestPayment, "II");

    // Allocate payments
    Accountant.PrincipalPaymentAllocation memory ppa = Accountant.allocatePrincipalPayment(
      principalPayment,
      balance,
      _principalOwed
    );
    Accountant.InterestPaymentAllocation memory ipa = Accountant.allocateInterestPayment(
      interestPayment,
      interestOwed(),
      interestAccrued()
    );

    // Update accounting vars
    uint256 newTotalInterestPaid = totalInterestPaid.add(ipa.owedInterestPayment).add(
      ipa.accruedInterestPayment
    );
    uint256 newPrincipalOwed = _principalOwed.sub(ppa.principalPayment);
    uint256 newBalance = balance.sub(ppa.principalPayment).sub(ppa.additionalBalancePayment);
    totalInterestPaid = newTotalInterestPaid;
    _principalOwed = newPrincipalOwed;
    balance = newBalance;

    // If no new interest or principal owed than it was a full payment
    uint256 newInterestOwed = interestOwed();
    if (newInterestOwed == 0 && newPrincipalOwed == 0 && _nextDueTime != 0) {
      lastFullPaymentTime = mostRecentLastDueTimeAt(block.timestamp);
    }

    return
      IV2TranchedPool.PaymentAllocation(
        ipa.owedInterestPayment,
        ipa.accruedInterestPayment,
        ppa.principalPayment,
        ppa.additionalBalancePayment,
        ipa.paymentRemaining + ppa.paymentRemaining
      );
  }

  /// @notice Get the dueTime in the past closest to `timestamp`
  function mostRecentLastDueTimeAt(uint256 timestamp) internal view returns (uint256) {
    // termEndTime doesn't necessarily align with the payment schedule but it is ALWAYS a due time
    if (timestamp >= termEndTime) {
      return termEndTime;
    }
    // The due time can be computed as the start time plus the duration of the payment periods elapsed
    // up to `timestamp`
    uint256 periodInSeconds = paymentPeriodInDays.mul(SECONDS_PER_DAY);
    uint256 numPeriodsElapsed = timestamp.sub(_termStartTime()).div(periodInSeconds);
    uint256 numPeriodsElapsedInSeconds = numPeriodsElapsed.mul(periodInSeconds);
    return _termStartTime().add(numPeriodsElapsedInSeconds);
  }

  /// @notice Calculate what the nextDueTime would be at `curTimestamp`
  function calculateNextDueTime(uint256 curTimestamp) internal view returns (uint256) {
    uint256 oldNextDueTime = _nextDueTime;
    uint256 secondsPerPeriod = paymentPeriodInDays.mul(SECONDS_PER_DAY);
    // You are about to do your first drawdown
    if (oldNextDueTime == 0) {
      return Math.min(curTimestamp.add(secondsPerPeriod), termEndTime);
    }
    // Active loan that has entered a new period, so return the *next* newNextDueTime.
    // But never return something after the termEndTime
    if (curTimestamp >= oldNextDueTime) {
      uint256 secondsToAdvance = (curTimestamp.sub(oldNextDueTime).div(secondsPerPeriod))
        .add(1)
        .mul(secondsPerPeriod);
      uint256 newNextDueTime = oldNextDueTime.add(secondsToAdvance);
      return Math.min(newNextDueTime, termEndTime);
    }
    // Active loan in current period, where we've already set the newNextDueTime correctly, so should not change.
    if (curTimestamp < oldNextDueTime) {
      return oldNextDueTime;
    }
    revert("Error: could not calculate next due time.");
  }

  function _isLate(uint256 timestamp) internal view returns (bool) {
    uint256 secondsElapsedSinceFullPayment = timestamp.sub(lastFullPaymentTime);
    return balance > 0 && secondsElapsedSinceFullPayment > paymentPeriodInDays.mul(SECONDS_PER_DAY);
  }

  function _termStartTime() internal view returns (uint256) {
    return termEndTime.sub(SECONDS_PER_DAY.mul(termInDays));
  }
}

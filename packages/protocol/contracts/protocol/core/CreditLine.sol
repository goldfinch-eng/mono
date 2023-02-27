// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {SafeCast} from "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {SafeMath} from "../../library/SafeMath.sol";
import {GoldfinchConfig} from "./GoldfinchConfig.sol";
import {ConfigHelper} from "./ConfigHelper.sol";
import {BaseUpgradeablePausable} from "./BaseUpgradeablePausable.sol";
import {Accountant} from "./Accountant.sol";
import {IERC20withDec} from "../../interfaces/IERC20withDec.sol";
import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {ICreditLine} from "../../interfaces/ICreditLine.sol";
import {ISchedule} from "../../interfaces/ISchedule.sol";

/**
 * @title CreditLine
 * @notice A contract that represents the agreement between Backers and
 *  a Borrower. Includes the terms of the loan, as well as the accounting state such as interest owed.
 *  A CreditLine instance belongs to a TranchedPool instance and is fully controlled by that TranchedPool
 *  instance. It should not operate in any standalone capacity and should generally be considered internal
 *  to the TranchedPool instance.
 * @author Warbler Labs Engineering
 */

contract CreditLine is BaseUpgradeablePausable, ICreditLine {
  using ConfigHelper for GoldfinchConfig;
  using PaymentScheduleLib for PaymentSchedule;

  uint256 internal constant INTEREST_DECIMALS = 1e18;
  uint256 internal constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 internal constant SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;

  GoldfinchConfig public config;

  // Credit line terms
  /// @inheritdoc ICreditLine
  address public override borrower;
  /// @inheritdoc ICreditLine
  uint256 public override currentLimit;
  /// @inheritdoc ICreditLine
  uint256 public override maxLimit;
  /// @inheritdoc ICreditLine
  uint256 public override interestApr;
  /// @inheritdoc ICreditLine
  uint256 public override lateFeeApr;

  // Accounting variables
  /// @inheritdoc ICreditLine
  uint256 public override balance;
  /// @inheritdoc ICreditLine
  uint256 public override totalInterestPaid;
  /// @inheritdoc ICreditLine
  uint256 public override lastFullPaymentTime;

  // Cumulative interest up to checkpointedAsOf
  uint256 internal _totalInterestAccrued;
  // Cumulative interest owed, i.e. a snapshot of _totalInterestAccrued up to
  // the last due time
  uint256 internal _totalInterestOwed;
  // The last time `_checkpoint()` was called
  uint256 internal _checkpointedAsOf;

  // Schedule variables
  PaymentSchedule public schedule;

  /*==============================================================================
  External functions
  =============================================================================*/

  /// @inheritdoc ICreditLine
  function initialize(
    address _config,
    address owner,
    address _borrower,
    uint256 _maxLimit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr
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
    lateFeeApr = _lateFeeApr;
    _checkpointedAsOf = block.timestamp;
    schedule.schedule = _schedule;

    // Unlock owner, which is a TranchedPool, for infinite amount
    assert(config.getUSDC().approve(owner, uint256(-1)));
  }

  function pay(
    uint paymentAmount
  ) external override onlyAdmin returns (ITranchedPool.PaymentAllocation memory) {
    (uint interestAmount, uint principalAmount) = Accountant.splitPayment(
      paymentAmount,
      balance,
      interestOwed(),
      interestAccrued(),
      principalOwed()
    );

    return pay(principalAmount, interestAmount);
  }

  /// @inheritdoc ICreditLine
  /// @dev II: insufficient interest
  function pay(
    uint256 principalPayment,
    uint256 interestPayment
  ) public override onlyAdmin returns (ITranchedPool.PaymentAllocation memory) {
    // The balance might change here.. Checkpoint amounts owed!
    _checkpoint();

    // Allocate payments
    ITranchedPool.PaymentAllocation memory pa = Accountant.allocatePayment(
      Accountant.AllocatePaymentParams({
        principalPayment: principalPayment,
        interestPayment: interestPayment,
        balance: balance,
        interestOwed: interestOwed(),
        interestAccrued: interestAccrued(),
        principalOwed: principalOwed()
      })
    );

    uint totalInterestPayment = pa.owedInterestPayment.add(pa.accruedInterestPayment);
    uint totalPrincipalPayment = pa.principalPayment.add(pa.additionalBalancePayment);

    totalInterestPaid = totalInterestPaid.add(totalInterestPayment);
    balance = balance.sub(totalPrincipalPayment);

    // If no new interest or principal owed than it was a full payment
    if (interestOwed() == 0 && principalOwed() == 0) {
      lastFullPaymentTime = block.timestamp;
    }

    return pa;
  }

  /// @inheritdoc ICreditLine
  function drawdown(uint256 amount) external override onlyAdmin {
    require(
      !schedule.isActive() || block.timestamp < termEndTime(),
      "After termEndTime or uninitialized"
    );
    require(amount.add(balance) <= limit(), "Cannot drawdown more than the limit");
    require(amount > 0, "Invalid drawdown amount");

    if (balance == 0) {
      lastFullPaymentTime = block.timestamp;
      if (!schedule.isActive()) {
        schedule.startAt(block.timestamp);
      }
    }

    // The balance is about to change.. checkpoint amounts owed!
    _checkpoint();

    balance = balance.add(amount);
    require(!_isLate(block.timestamp), "Cannot drawdown when payments are past due");
  }

  // ------------------------------------------------------------------------------
  // Tranched Pool Proxy methods
  // ------------------------------------------------------------------------------

  function setLimit(uint256 newAmount) external override onlyAdmin {
    require(newAmount <= maxLimit, "Cannot be more than the max limit");
    currentLimit = newAmount;
  }

  function setMaxLimit(uint256 newAmount) external override onlyAdmin {
    maxLimit = newAmount;
  }

  /*==============================================================================
  External view functions
  =============================================================================*/
  /// @notice We keep this to conform to the ICreditLine interface, but it's redundant information
  ///   now that we have `checkpointedAsOf`
  function interestAccruedAsOf() public view virtual override returns (uint256) {
    return _checkpointedAsOf;
  }

  /// @inheritdoc ICreditLine
  function isLate() external view override returns (bool) {
    return _isLate(block.timestamp);
  }

  /// @inheritdoc ICreditLine
  function withinPrincipalGracePeriod() public view override returns (bool) {
    return schedule.withinPrincipalGracePeriodAt(block.timestamp);
  }

  /// @inheritdoc ICreditLine
  function interestOwed() public view virtual override returns (uint256) {
    return totalInterestOwed().saturatingSub(totalInterestPaid);
  }

  /// @inheritdoc ICreditLine
  function interestOwedAt(uint256 timestamp) public view override returns (uint256) {
    /// @dev IT: Invalid timestamp
    require(timestamp >= _checkpointedAsOf, "IT");
    return totalInterestOwedAt(timestamp).saturatingSub(totalInterestPaid);
  }

  /// @inheritdoc ICreditLine
  function totalInterestAccrued() public view override returns (uint256) {
    return totalInterestAccruedAt(block.timestamp);
  }

  /// @inheritdoc ICreditLine
  function totalInterestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    require(timestamp >= _checkpointedAsOf, "IT");
    return _totalInterestAccrued.add(_interestAccruedOverPeriod(_checkpointedAsOf, timestamp));
  }

  /// @inheritdoc ICreditLine
  function totalInterestOwedAt(uint256 timestamp) public view override returns (uint256) {
    require(timestamp >= _checkpointedAsOf, "IT");
    // After loan maturity there is no concept of additional interest. All interest accrued
    // automatically beocmes interest owed.
    if (timestamp > termEndTime()) {
      return totalInterestAccruedAt(timestamp);
    }

    // If we crossed a payment period then add all interest accrued between last checkpoint and
    // the most recent crossed period
    uint256 mostRecentInterestDueTime = schedule.previousInterestDueTimeAt(timestamp);
    bool crossedPeriod = _checkpointedAsOf <= mostRecentInterestDueTime &&
      mostRecentInterestDueTime <= timestamp;
    return
      crossedPeriod // Interest owed doesn't change within a payment period
        ? _totalInterestAccrued.add(
          _interestAccruedOverPeriod(_checkpointedAsOf, mostRecentInterestDueTime)
        )
        : _totalInterestOwed;
  }

  /// @inheritdoc ICreditLine
  function limit() public view override returns (uint256) {
    return currentLimit.sub(totalPrincipalOwed());
  }

  /// @inheritdoc ICreditLine
  function totalPrincipalPaid() public view override returns (uint256) {
    return currentLimit.sub(balance);
  }

  /// @inheritdoc ICreditLine
  function totalInterestOwed() public view override returns (uint256) {
    return totalInterestOwedAt(block.timestamp);
  }

  /// @inheritdoc ICreditLine
  function interestAccrued() public view override returns (uint256) {
    return interestAccruedAt(block.timestamp);
  }

  /// @inheritdoc ICreditLine
  function principalOwedAt(uint256 timestamp) public view override returns (uint256) {
    return totalPrincipalOwedAt(timestamp).saturatingSub(totalPrincipalPaid());
  }

  /// @inheritdoc ICreditLine
  function totalPrincipalOwedAt(uint256 timestamp) public view override returns (uint256) {
    if (!schedule.isActive()) {
      return 0;
    }

    uint256 currentPrincipalPeriod = schedule.principalPeriodAt(timestamp);
    uint256 totalPrincipalPeriods = schedule.totalPrincipalPeriods();
    return currentLimit.mul(currentPrincipalPeriod).div(totalPrincipalPeriods);
  }

  /// @inheritdoc ICreditLine
  function principalOwed() public view override returns (uint256) {
    return totalPrincipalOwedAt(block.timestamp).saturatingSub(totalPrincipalPaid());
  }

  /// @inheritdoc ICreditLine
  function interestAccruedAt(uint256 timestamp) public view override returns (uint256) {
    require(timestamp >= _checkpointedAsOf, "IT");
    return
      totalInterestAccruedAt(timestamp).sub(
        (Math.max(totalInterestPaid, totalInterestOwedAt(timestamp)))
      );
  }

  /// @inheritdoc ICreditLine
  function nextDueTime() external view override returns (uint256) {
    return schedule.nextDueTimeAt(block.timestamp);
  }

  function nextDueTimeAt(uint256 timestamp) external view returns (uint256) {
    return schedule.nextDueTimeAt(timestamp);
  }

  /// @inheritdoc ICreditLine
  function termStartTime() public view override returns (uint256) {
    return schedule.termStartTime();
  }

  /// @inheritdoc ICreditLine
  function termEndTime() public view override returns (uint256) {
    return schedule.termEndTime();
  }

  /// @inheritdoc ICreditLine
  function totalPrincipalOwed() public view override returns (uint256) {
    return totalPrincipalOwedAt(block.timestamp);
  }

  /*==============================================================================
  Internal function
  =============================================================================*/

  /// @notice Updates accounting variables. This should be called before any changes to `balance`!
  function _checkpoint() internal {
    _totalInterestOwed = totalInterestOwed();
    _totalInterestAccrued = totalInterestAccrued();
    _checkpointedAsOf = block.timestamp;
  }

  /*==============================================================================
  Internal view functions
  =============================================================================*/

  function _interestAccruedOverPeriod(uint256 start, uint256 end) internal view returns (uint256) {
    uint256 secondsElapsed = end.sub(start);
    uint256 totalInterestPerYear = balance.mul(interestApr).div(INTEREST_DECIMALS);
    uint256 regularInterest = totalInterestPerYear.mul(secondsElapsed).div(SECONDS_PER_YEAR);
    uint256 lateFeeInterest = _lateFeesAccuredOverPeriod(start, end);
    return regularInterest.add(lateFeeInterest);
  }

  function _lateFeesAccuredOverPeriod(uint256 start, uint256 end) internal view returns (uint256) {
    uint256 oldestUnpaidDueTime = schedule.nextDueTimeAt(lastFullPaymentTime);

    uint256 lateFeeStartsAt = Math.max(
      start,
      oldestUnpaidDueTime.add(config.getLatenessGracePeriodInDays().mul(SECONDS_PER_DAY))
    );

    if (lateFeeStartsAt < end) {
      uint256 lateSecondsElapsed = end.sub(lateFeeStartsAt);
      uint256 lateFeeInterestPerYear = balance.mul(lateFeeApr).div(INTEREST_DECIMALS);
      return lateFeeInterestPerYear.mul(lateSecondsElapsed).div(SECONDS_PER_YEAR);
    }

    return 0;
  }

  function _isLate(uint256 timestamp) internal view returns (bool) {
    uint256 gracePeriodInSeconds = config.getLatenessGracePeriodInDays().mul(SECONDS_PER_DAY);
    uint256 oldestUnpaidDueTime = schedule.nextDueTimeAt(lastFullPaymentTime);
    return balance > 0 && timestamp > oldestUnpaidDueTime.add(gracePeriodInSeconds);
  }
}

/// @notice Convenience struct for passing startTime to all Schedule methods
struct PaymentSchedule {
  ISchedule schedule;
  uint64 startTime;
}

library PaymentScheduleLib {
  using SafeCast for uint256;
  using PaymentScheduleLib for PaymentSchedule;

  function startAt(PaymentSchedule storage s, uint256 timestamp) internal {
    assert(s.startTime == 0);
    s.startTime = timestamp.toUint64();
  }

  function previousDueTimeAt(
    PaymentSchedule storage s,
    uint256 timestamp
  ) internal view isActiveMod(s) returns (uint256) {
    return s.schedule.previousDueTimeAt(s.startTime, timestamp);
  }

  function previousInterestDueTimeAt(
    PaymentSchedule storage s,
    uint256 timestamp
  ) internal view isActiveMod(s) returns (uint256) {
    return s.schedule.previousInterestDueTimeAt(s.startTime, timestamp);
  }

  function principalPeriodAt(
    PaymentSchedule storage s,
    uint256 timestamp
  ) internal view isActiveMod(s) returns (uint256) {
    return s.schedule.principalPeriodAt(s.startTime, timestamp);
  }

  function totalPrincipalPeriods(PaymentSchedule storage s) internal view returns (uint256) {
    return s.schedule.totalPrincipalPeriods();
  }

  function isActive(PaymentSchedule storage s) internal view returns (bool) {
    return s.startTime != 0;
  }

  function termEndTime(PaymentSchedule storage s) internal view returns (uint256) {
    return s.isActive() ? s.schedule.termEndTime(s.startTime) : 0;
  }

  function termStartTime(PaymentSchedule storage s) internal view returns (uint256) {
    return s.isActive() ? s.schedule.termStartTime(s.startTime) : 0;
  }

  function nextDueTimeAt(
    PaymentSchedule storage s,
    uint256 timestamp
  ) internal view returns (uint256) {
    return s.isActive() ? s.schedule.nextDueTimeAt(s.startTime, timestamp) : 0;
  }

  function withinPrincipalGracePeriodAt(
    PaymentSchedule storage s,
    uint256 timestamp
  ) internal view returns (bool) {
    return !s.isActive() || s.schedule.withinPrincipalGracePeriodAt(s.startTime, timestamp);
  }

  modifier isActiveMod(PaymentSchedule storage s) {
    // @dev: NA: not active
    require(s.isActive(), "NA");
    _;
  }
}

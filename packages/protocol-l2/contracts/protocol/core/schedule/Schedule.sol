// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
pragma experimental ABIEncoderV2;

import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {SaturatingSub} from "../../library/SaturatingSub.sol";

/**
 * @title Schedule
 * @author Warbler Labs Engineering
 * @notice A contract meant to be re-used between tranched pools to determine when payments are due
 *         using some period mapper contract that maps timestamps to real world concepts of time (months).
 *         This contract allows a user to specify how often interest payments and principal payments should come
 *         due by allowing the creator to specify the length of of interest periods and principal periods. Additionally
 *         the creator can specify how many of the principal periods are considered "grace periods"
 *
 * Example:
 * Here's a visualization of a schedule with the following parameters
 * periodMapper = monthly periods
 * periodsInTerm = 12 (1 year)
 * periodsPerInterestPeriod = 3 (quarterly)
 * periodsPerPrincipalPeriod = 6 (halfly)
 * gracePrincipalPeriods = 1
 *
 *                       +- Stub Period     +- Principal Grace Period
 *  grace periods        v                  v
 *                     +---+-----------------------+-----------------------+
 *  principal periods  |///|=======================|           0           |
 *                     |///+-----------+-----------+-----------+-----------+ E
 *  interest periods   |///|     0     |     1     |     2     |     3     | N
 *                     +---+---+---+---+---+---+---+---+---+---+---+---+---+ D
 *  periods            |FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JAN|FEB|
 *                     |   | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10| 11|
 *                  ---+---+---+---+---+---+---+---+---+---+---+---+---+---+---
 *  absolute        ...| 25| 26| 27| 28| 29| 30| 31| 32| 33| 34| 35| 36| 37|...
 *  periods            |   |   |   |   |   |   |   |   |   |   |   |   |   |
 *                  ---+---+---+---+---+---+---+---+---+---+---+---+---+---+---
 *                      ^
 *                      +- start time
 * When a borrower draws down, a "stub period" is created. This period is the remainder of the
 * period they drew down in, but at the end of this period no payment of any kind should be due.
 * We treat this stub period as an extension to period 0.
 *
 * At the end of each interest or principal period a payment is expected. For example
 * imagine today is Oct 10th. Your next interest payment will be the beginning of December
 * because the current interest period, period 2, ends in december. Your next principal payment
 * will be due at the end of February because the current principal period, period 0, ends in
 * February. This is also the end of the loan, and so all interest and principal should be due
 * at this time.
 *
 * @dev Because this contract is meant to be re-used between contracts, the "start time" is not stored on this contract
 *      Instead, it's passed in to each function call.
 */
contract Schedule is ISchedule {
  using Math for uint256;

  /// @notice the payment date schedule
  IPeriodMapper public immutable periodMapper;

  /// @notice the number of periods in the term of the loan
  uint256 public immutable override periodsInTerm;

  /// @notice the number of payment periods that need to pass before interest
  ///         comes due
  uint256 public immutable override periodsPerInterestPeriod;

  /// @notice the number of payment periods that need to pass before principal
  ///         comes due
  uint256 public immutable override periodsPerPrincipalPeriod;

  /// @notice the number of principal periods where no principal will be due
  uint256 public immutable override gracePrincipalPeriods;

  //===============================================================================
  // external functions
  //===============================================================================

  /// @param _periodMapper contract that maps timestamps to periods
  /// @param _periodsInTerm the number of periods in the term of the loan
  /// @param _periodsPerPrincipalPeriod the number of payment periods that need to pass before principal
  ///         comes due
  /// @param _periodsPerInterestPeriod the number of payment periods that need to pass before interest
  ///         comes due.
  /// @param _gracePrincipalPeriods principal periods where principal will not be due
  constructor(
    IPeriodMapper _periodMapper,
    uint256 _periodsInTerm,
    uint256 _periodsPerPrincipalPeriod,
    uint256 _periodsPerInterestPeriod,
    uint256 _gracePrincipalPeriods
  ) public {
    require(address(_periodMapper) != address(0), "Z");

    require(_periodsInTerm > 0, "Z");
    require(_periodsPerPrincipalPeriod > 0, "Z");
    require(_periodsPerInterestPeriod > 0, "Z");

    require(_periodsInTerm % _periodsPerPrincipalPeriod == 0, "PPPP");
    require(_periodsInTerm % _periodsPerInterestPeriod == 0, "PPIP");

    uint256 nPrincipalPeriods = _periodsInTerm / _periodsPerPrincipalPeriod;
    require(_gracePrincipalPeriods < nPrincipalPeriods, "GPP");

    periodMapper = _periodMapper;
    periodsInTerm = _periodsInTerm;
    periodsPerPrincipalPeriod = _periodsPerPrincipalPeriod;
    periodsPerInterestPeriod = _periodsPerInterestPeriod;
    gracePrincipalPeriods = _gracePrincipalPeriods;
  }

  /// @inheritdoc ISchedule
  function interestPeriodAt(
    uint256 startTime,
    uint256 timestamp
  ) public view override returns (uint256) {
    return
      Math.min(_periodToInterestPeriod(periodAt(startTime, timestamp)), totalInterestPeriods());
  }

  /// @inheritdoc ISchedule
  function periodAt(uint256 startTime, uint256 timestamp) public view override returns (uint256) {
    uint256 currentAbsPeriod = periodMapper.periodOf(timestamp);
    uint256 startPeriod = _termStartAbsolutePeriod(startTime);

    return Math.min(currentAbsPeriod.saturatingSub(startPeriod), periodsInTerm);
  }

  /// @inheritdoc ISchedule
  function principalPeriodAt(
    uint256 startTime,
    uint256 timestamp
  ) public view override returns (uint256) {
    return
      Math.min(_periodToPrincipalPeriod(periodAt(startTime, timestamp)), totalPrincipalPeriods());
  }

  /// @inheritdoc ISchedule
  function withinPrincipalGracePeriodAt(
    uint256 startTime,
    uint256 timestamp
  ) public view override returns (bool) {
    return
      timestamp < startTime ||
      (timestamp >= startTime &&
        periodAt(startTime, timestamp).div(periodsPerPrincipalPeriod) < gracePrincipalPeriods);
  }

  /// @inheritdoc ISchedule
  function nextDueTimeAt(
    uint256 startTime,
    uint256 timestamp
  ) external view override returns (uint256) {
    return
      Math.min(
        nextPrincipalDueTimeAt(startTime, timestamp),
        nextInterestDueTimeAt(startTime, timestamp)
      );
  }

  /// @inheritdoc ISchedule
  function previousDueTimeAt(
    uint256 startTime,
    uint256 timestamp
  ) external view override returns (uint256) {
    return
      Math.max(
        previousInterestDueTimeAt(startTime, timestamp),
        previousPrincipalDueTimeAt(startTime, timestamp)
      );
  }

  /// @inheritdoc ISchedule
  function totalPrincipalPeriods() public view override returns (uint256) {
    // To make amortization math easy, we want to exclude grace periods from this
    return periodsInTerm.div(periodsPerPrincipalPeriod).sub(gracePrincipalPeriods);
  }

  /// @inheritdoc ISchedule
  function totalInterestPeriods() public view override returns (uint256) {
    return periodsInTerm.div(periodsPerInterestPeriod);
  }

  /// @inheritdoc ISchedule
  function termEndTime(uint256 startTime) external view override returns (uint256) {
    uint256 endPeriod = _termEndAbsolutePeriod(startTime);
    return periodMapper.startOf(endPeriod);
  }

  /// @inheritdoc ISchedule
  function termStartTime(uint256 startTime) external view override returns (uint256) {
    uint256 startPeriod = _termStartAbsolutePeriod(startTime);
    return periodMapper.startOf(startPeriod);
  }

  /// @inheritdoc ISchedule
  function previousInterestDueTimeAt(
    uint256 startTime,
    uint256 timestamp
  ) public view override returns (uint256) {
    uint interestPeriod = interestPeriodAt(startTime, timestamp);
    return interestPeriod > 0 ? _startOfInterestPeriod(startTime, interestPeriod) : 0;
  }

  /// @inheritdoc ISchedule
  function previousPrincipalDueTimeAt(
    uint256 startTime,
    uint256 timestamp
  ) public view override returns (uint256) {
    uint principalPeriod = principalPeriodAt(startTime, timestamp);
    return principalPeriod > 0 ? _startOfPrincipalPeriod(startTime, principalPeriod) : 0;
  }

  /// @inheritdoc ISchedule
  function nextPrincipalDueTimeAt(
    uint256 startTime,
    uint256 timestamp
  ) public view override returns (uint256) {
    uint256 nextPrincipalPeriod = Math.min(
      totalPrincipalPeriods(),
      principalPeriodAt(startTime, timestamp).add(1)
    );
    return _startOfPrincipalPeriod(startTime, nextPrincipalPeriod);
  }

  /// @inheritdoc ISchedule
  function nextInterestDueTimeAt(
    uint256 startTime,
    uint256 timestamp
  ) public view override returns (uint256) {
    uint256 nextInterestPeriod = Math.min(
      totalInterestPeriods(),
      interestPeriodAt(startTime, timestamp).add(1)
    );
    return _startOfInterestPeriod(startTime, nextInterestPeriod);
  }

  /// @inheritdoc ISchedule
  function periodEndTime(uint256 startTime, uint256 period) public view override returns (uint256) {
    uint256 absPeriod = _periodToAbsolutePeriod(startTime, period);
    return periodMapper.startOf(absPeriod + 1);
  }

  //===============================================================================
  // Internal functions
  //===============================================================================

  /// @notice Returns the absolute period that the terms will end in, accounting
  ///           for the stub period
  function _termEndAbsolutePeriod(uint256 startTime) internal view returns (uint256) {
    return _termStartAbsolutePeriod(startTime).add(periodsInTerm);
  }

  /// @notice Returns the absolute period that the terms started in, accounting
  ///           for the stub period
  function _termStartAbsolutePeriod(uint256 startTime) internal view returns (uint256) {
    // We add one here so that a "stub period" is created. Example: Imagine
    // a the borrower draws down in the 15th of Jan. It would be incorrect for them
    // to make a payment on Feb 1, as it would not be a full payment period. Instead
    // we count the first 15 days as an extension on the first period, or a "stub period"
    return periodMapper.periodOf(startTime).add(1);
  }

  /// @notice Convert a period to a principal period
  function _periodToPrincipalPeriod(uint256 p) internal view returns (uint256) {
    // To make amortization math easy, we want to make it so that the "0th" principal
    // period is the first non-grace principal period.
    return p.div(periodsPerPrincipalPeriod).saturatingSub(gracePrincipalPeriods);
  }

  /// @notice Convert a period to an interest period
  function _periodToInterestPeriod(uint256 p) internal view returns (uint256) {
    return p.div(periodsPerInterestPeriod);
  }

  /// @notice Convert an interest period to a normal period
  function _interestPeriodToPeriod(uint256 p) internal view returns (uint256) {
    return p.mul(periodsPerInterestPeriod);
  }

  /// @notice Convert a principal period to a normal period
  function _principalPeriodToPeriod(uint256 p) internal view returns (uint256) {
    return p.mul(periodsPerPrincipalPeriod);
  }

  /// @notice Convert a period to an absolute period. An absolute period is relative to
  ///   the beginning of time rather than being relative to the start time
  function _periodToAbsolutePeriod(uint256 startTime, uint256 p) internal view returns (uint256) {
    return _termStartAbsolutePeriod(startTime).add(p);
  }

  /// @notice Returns the starting timestamp of a principal period
  function _startOfPrincipalPeriod(
    uint256 startTime,
    uint256 principalPeriod
  ) internal view returns (uint256) {
    uint256 period = _principalPeriodToPeriod(principalPeriod.add(gracePrincipalPeriods));
    uint256 absPeriod = _periodToAbsolutePeriod(startTime, period);
    return periodMapper.startOf(absPeriod);
  }

  /// @notice Returns the starting timestamp of an interest period
  function _startOfInterestPeriod(
    uint256 startTime,
    uint256 interestPeriod
  ) internal view returns (uint256) {
    uint256 period = _interestPeriodToPeriod(interestPeriod);
    uint256 absPeriod = _periodToAbsolutePeriod(startTime, period);
    return periodMapper.startOf(absPeriod);
  }
}

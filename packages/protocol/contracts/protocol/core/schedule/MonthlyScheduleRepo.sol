// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {IMonthlyScheduleRepo} from "../../../interfaces/IMonthlyScheduleRepo.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";

import {MonthlyPeriodMapper} from "./MonthlyPeriodMapper.sol";
import {Schedule} from "./Schedule.sol";

/**
 * @notice Repository for re-usable schedules that function on calendar month periods.
 * In general periods can be any length, but Warbler maintains a repository of schedules
 * with monthly periods because that's the most common type of schedule used on the
 * Goldfinch protocol.
 */
contract MonthlyScheduleRepo is IMonthlyScheduleRepo {
  IPeriodMapper public override periodMapper;

  mapping(bytes32 => address) private schedules;

  constructor() public {
    periodMapper = new MonthlyPeriodMapper();
  }

  /// @notice Get the schedule with the requested params. Reverts if the
  /// schedule is not in the repo - see _createSchedule_
  /// @return schedule the schedule
  function getSchedule(
    uint256 periodsInTerm,
    uint256 periodsPerPrincipalPeriod,
    uint256 periodsPerInterestPeriod,
    uint256 gracePrincipalPeriods
  ) external view override returns (ISchedule) {
    bytes32 scheduleId = getScheduleId(
      periodsInTerm,
      periodsPerPrincipalPeriod,
      periodsPerInterestPeriod,
      gracePrincipalPeriods
    );
    address schedule = schedules[scheduleId];
    require(schedule != address(0), "Schedule doesn't exist");
    return ISchedule(schedule);
  }

  /// @notice Add a schedule with the provided params to the repo
  /// @return schedule the schedule
  function createSchedule(
    uint256 periodsInTerm,
    uint256 periodsPerPrincipalPeriod,
    uint256 periodsPerInterestPeriod,
    uint256 gracePrincipalPeriods
  ) external override returns (ISchedule) {
    bytes32 scheduleId = getScheduleId(
      periodsInTerm,
      periodsPerPrincipalPeriod,
      periodsPerInterestPeriod,
      gracePrincipalPeriods
    );

    address schedule = schedules[scheduleId];

    // No need to create it again if it already exists
    if (schedule != address(0)) {
      return ISchedule(schedule);
    }

    Schedule newSchedule = new Schedule(
      periodMapper,
      periodsInTerm,
      periodsPerPrincipalPeriod,
      periodsPerInterestPeriod,
      gracePrincipalPeriods
    );
    schedules[scheduleId] = address(newSchedule);
    return newSchedule;
  }

  function getScheduleId(
    uint256 periodsInTerm,
    uint256 periodsPerPrincipalPeriod,
    uint256 periodsPerInterestPeriod,
    uint256 gracePrincipalPeriods
  ) private pure returns (bytes32) {
    // Right pad with 0 params so we have the option to add new parameters in the future
    // Use encode instead of encodePacked because non-padded concatenation can lead to
    // non-unique ids
    bytes memory concattedParams = abi.encode(
      periodsInTerm,
      periodsPerPrincipalPeriod,
      periodsPerInterestPeriod,
      gracePrincipalPeriods
    );
    return keccak256(concattedParams);
  }
}

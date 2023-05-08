// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract BulletScheduleTest is Test {
  IPeriodMapper internal m = new MonthlyPeriodMapper();
  Schedule internal s;

  function testPrincipalPeriodIs0BeforeTermEnd(
    BulletScheduleParams memory p,
    uint256 startTime,
    uint256 timeLtEnd
  ) public withValidParams(p) init(p) {
    startTime = bound(startTime, 0, type(uint64).max / 2);
    uint256 endTime = s.termEndTime(startTime);
    assertGt(endTime, 0);

    vm.assume(timeLtEnd <= endTime);

    uint256 p = s.principalPeriodAt(startTime, timeLtEnd);
    assertEq(p, 0);
  }

  function testPrincipalPeriodIsOneAfterTermEnd(
    BulletScheduleParams memory p,
    uint256 startTime,
    uint256 timeGteEndTime
  ) public withValidParams(p) init(p) {
    startTime = bound(startTime, 0, type(uint64).max / 2);
    uint256 endTime = s.termEndTime(startTime);
    assertGt(endTime, 0);

    vm.assume(timeGteEndTime > endTime);

    assertEq(s.principalPeriodAt(startTime, timeGteEndTime), 1);
  }

  function testAfterTermEndTimeInterestPeriodIsAlwaysTotalInterestPeriods(
    BulletScheduleParams memory p,
    uint256 startTime,
    uint256 afterEndTime
  ) public withValidParams(p) init(p) {
    startTime = bound(startTime, 0, type(uint64).max / 2);
    uint256 endTime = s.termEndTime(startTime);
    assertGt(endTime, 0);

    vm.assume(afterEndTime > endTime);

    assertEq(s.interestPeriodAt(startTime, afterEndTime), s.totalInterestPeriods());
  }

  function testOnlyOnePrincipalPeriod(
    BulletScheduleParams memory p
  ) public withValidParams(p) init(p) {
    assertEq(s.totalPrincipalPeriods(), 1);
  }

  modifier init(BulletScheduleParams memory p) {
    s = new Schedule(m, p.periodsInTerm, p.periodsInTerm, p.periodsPerInterestPeriod, 0);
    _;
  }

  modifier withValidParams(BulletScheduleParams memory p) {
    p.periodsInTerm = bound(p.periodsInTerm, 1, type(uint16).max);
    p.periodsPerInterestPeriod = bound(p.periodsPerInterestPeriod, 1, type(uint16).max);

    vm.assume(p.periodsInTerm % p.periodsPerInterestPeriod == 0);

    _;
  }

  struct BulletScheduleParams {
    uint256 periodsInTerm;
    uint256 periodsPerInterestPeriod;
  }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract ScheduleTest is Test {
  IPeriodMapper internal m = new MonthlyPeriodMapper();
  Schedule internal s;
  uint256 internal constant START_TIME = 2051222400;

  function testTermEndTimeGtTermStartTime(ScheduleParams memory p) public initWithValidParams(p) {
    uint256 termStartTime = s.termStartTime(START_TIME);
    uint256 termEndTime = s.termEndTime(START_TIME);

    assertGe(termStartTime, START_TIME, "startTime > termStartTime");
    assertGt(termEndTime, termStartTime, "termEndTime < termStartTime");
  }

  function testNextDueTimeGeTermStart(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertGe(s.nextDueTimeAt(START_TIME, t), s.termStartTime(START_TIME));
  }

  function testNextDueTimeLeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.nextDueTimeAt(START_TIME, t), s.termEndTime(START_TIME));
  }

  function testPreviousDueTimeLeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.previousDueTimeAt(START_TIME, t), s.termEndTime(START_TIME));
  }

  function testPeriodAtLePeriodsInTerm(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.periodAt(START_TIME, t), s.periodsInTerm());
  }

  function testTotalPrincipalPeriodsGe1(ScheduleParams memory p) public initWithValidParams(p) {
    assertGe(s.totalPrincipalPeriods(), 1);
  }

  function testTotalInterestjPeriodsGe1(ScheduleParams memory p) public initWithValidParams(p) {
    assertGe(s.totalInterestPeriods(), 1);
  }

  function testInterestPeriodAtLeTotalInterestPeriods(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.interestPeriodAt(START_TIME, t), s.totalInterestPeriods());
  }

  function testPrincipalPeriodAtLeTotalPrincipalPeriods(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.principalPeriodAt(START_TIME, t), s.totalPrincipalPeriods());
  }

  function testNextDueTimeAtGtNowBeforeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    uint256 termEndTime = s.termEndTime(START_TIME);
    t = bound(t, 0, termEndTime - 1);

    assertGe(s.nextDueTimeAt(START_TIME, t), t);
  }

  function tesPreviousPrincipalDueTimeGtNowBeforeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    uint256 termEndTime = s.termEndTime(START_TIME);
    vm.assume(t > s.termStartTime(START_TIME));
    vm.assume(t < termEndTime);

    assertLe(s.previousPrincipalDueTimeAt(START_TIME, t), t);
  }

  function testNextDueTimeEqTermEndAfterTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    uint256 termEndTime = s.termEndTime(START_TIME);
    t = bound(t, termEndTime + 1, type(uint256).max);

    assertEq(s.nextDueTimeAt(START_TIME, t), termEndTime);
  }

  modifier initWithValidParams(ScheduleParams memory p) {
    p.periodsInTerm = bound(p.periodsInTerm, 1, type(uint16).max);
    p.periodsPerInterestPeriod = bound(p.periodsPerInterestPeriod, 1, type(uint16).max);
    p.periodsPerPrincipalPeriod = bound(p.periodsPerPrincipalPeriod, 1, type(uint16).max);

    vm.assume(p.periodsInTerm % p.periodsPerInterestPeriod == 0);
    vm.assume(p.periodsInTerm % p.periodsPerPrincipalPeriod == 0);

    uint256 nPrincipalPeriods = p.periodsInTerm / p.periodsPerPrincipalPeriod;
    vm.assume(p.gracePrincipalPeriods < nPrincipalPeriods);

    s = new Schedule(
      m,
      p.periodsInTerm,
      p.periodsPerPrincipalPeriod,
      p.periodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );

    _;
  }

  struct ScheduleParams {
    uint256 periodsInTerm;
    uint256 periodsPerInterestPeriod;
    uint256 periodsPerPrincipalPeriod;
    uint256 gracePrincipalPeriods;
  }
}

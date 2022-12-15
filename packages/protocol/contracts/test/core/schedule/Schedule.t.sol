// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract ScheduleTest is Test {
  IPeriodMapper internal m = new MonthlyPeriodMapper();
  Schedule internal s;
  uint256 internal constant startTime = 2051222400;

  function testTermEndTimeGtTermStartTime(ScheduleParams memory p) public initWithValidParams(p) {
    uint256 termStartTime = s.termStartTime(startTime);
    uint256 termEndTime = s.termEndTime(startTime);

    assertGe(termStartTime, startTime, "startTime > termStartTime");
    assertGt(termEndTime, termStartTime, "termEndTime < termStartTime");
  }

  function testNextDueTimeGeTermStart(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertGe(s.nextDueTimeAt(startTime, t), s.termStartTime(startTime));
  }

  function testNextDueTimeLeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.nextDueTimeAt(startTime, t), s.termEndTime(startTime));
  }

  function testPreviousDueTimeLeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.previousDueTimeAt(startTime, t), s.termEndTime(startTime));
  }

  function testPeriodAtLePeriodsInTerm(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.periodAt(startTime, t), s.periodsInTerm());
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
    assertLe(s.interestPeriodAt(startTime, t), s.totalInterestPeriods());
  }

  function testPrincipalPeriodAtLeTotalPrincipalPeriods(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    assertLe(s.principalPeriodAt(startTime, t), s.totalPrincipalPeriods());
  }

  function testNextDueTimeAtGtNowBeforeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    uint256 termEndTime = s.termEndTime(startTime);
    console.log(termEndTime);
    console.log(t);
    vm.assume(t < termEndTime);

    assertGe(s.nextDueTimeAt(startTime, t), t);
  }

  function tesPreviousPrincipalDueTimeGtNowBeforeTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    uint256 termEndTime = s.termEndTime(startTime);
    vm.assume(t > s.termStartTime(startTime));
    vm.assume(t < termEndTime);

    assertLe(s.previousPrincipalDueTimeAt(startTime, t), t);
  }

  function testNextDueTimeEqTermEndAfterTermEnd(
    ScheduleParams memory p,
    uint256 t
  ) public initWithValidParams(p) {
    uint256 termEndTime = s.termEndTime(startTime);
    vm.assume(t > termEndTime);

    assertEq(s.nextDueTimeAt(startTime, t), termEndTime);
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

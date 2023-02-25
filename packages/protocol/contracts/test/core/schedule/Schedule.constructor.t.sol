// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract ScheduleConstructorTest is Test {
  IPeriodMapper internal m = new MonthlyPeriodMapper();
  Schedule internal s;

  function testRevertsWhenPeriodsInTermIsZero(ScheduleParams memory p) public withValidParams(p) {
    vm.expectRevert(bytes("Z"));
    s = new Schedule(
      m,
      0, // p.periodsInTerm,
      p.periodsPerPrincipalPeriod,
      p.periodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );
  }

  function testRevertsWhenPeriodMapperIsNull(ScheduleParams memory p) public withValidParams(p) {
    vm.expectRevert(bytes("Z"));
    s = new Schedule(
      IPeriodMapper(address(0)), // m,
      p.periodsInTerm,
      p.periodsPerPrincipalPeriod,
      p.periodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );
  }

  function testRevertsWhenPeriodsPerPrincipalPeriodGtPeriodsInTerm(
    ScheduleParams memory p,
    uint256 badPeriodsPerPrincipalPeriod
  ) public withValidParams(p) {
    vm.assume(badPeriodsPerPrincipalPeriod > p.periodsInTerm);
    vm.expectRevert(bytes("PPPP"));
    s = new Schedule(
      m,
      p.periodsInTerm,
      badPeriodsPerPrincipalPeriod,
      p.periodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );
  }

  function testRevertsWhenPeriodsPerPrincipalPeriodIsZero(
    ScheduleParams memory p
  ) public withValidParams(p) {
    vm.expectRevert(bytes("Z"));
    s = new Schedule(
      m,
      p.periodsInTerm,
      0, // p.periodsPerPrincipalPeriod,
      p.periodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );
  }

  function testRevertsWhenPeriodsPerInterestPeriodGtPeriodsInTerm(
    ScheduleParams memory p,
    uint256 badPeriodsPerInterestPeriod
  ) public withValidParams(p) {
    vm.assume(badPeriodsPerInterestPeriod > p.periodsInTerm);
    vm.expectRevert(bytes("PPIP"));
    s = new Schedule(
      m,
      p.periodsInTerm,
      p.periodsPerPrincipalPeriod,
      badPeriodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );
  }

  function testRevertsWhenPeriodsPerInterestPeriodIsZero(
    ScheduleParams memory p
  ) public withValidParams(p) {
    vm.expectRevert(bytes("Z"));
    s = new Schedule(
      m,
      p.periodsInTerm,
      p.periodsPerPrincipalPeriod,
      0, // p.periodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );
  }

  function testRevertsWhenGracePrincipalPeriodsIsGeTotalPrincipalPeriods(
    ScheduleParams memory p,
    uint256 badGracePrincipalPeriods
  ) public withValidParams(p) {
    uint256 totalPrincipalPeriods = p.periodsInTerm / p.periodsPerPrincipalPeriod;
    vm.assume(badGracePrincipalPeriods >= totalPrincipalPeriods);
    vm.expectRevert(bytes("GPP"));
    s = new Schedule(
      m,
      p.periodsInTerm,
      p.periodsPerPrincipalPeriod,
      p.periodsPerInterestPeriod,
      badGracePrincipalPeriods
    );
  }

  function testSucceedsWithValidParams(ScheduleParams memory p) public withValidParams(p) {
    s = new Schedule(
      m,
      p.periodsInTerm,
      p.periodsPerPrincipalPeriod,
      p.periodsPerInterestPeriod,
      p.gracePrincipalPeriods
    );
    assertGe(s.totalPrincipalPeriods(), 1);
    assertGe(s.totalInterestPeriods(), 1);
  }

  modifier withValidParams(ScheduleParams memory p) {
    p.periodsInTerm = bound(p.periodsInTerm, 1, type(uint8).max);
    p.periodsPerInterestPeriod = bound(p.periodsPerInterestPeriod, 1, type(uint8).max);
    p.periodsPerPrincipalPeriod = bound(p.periodsPerPrincipalPeriod, 1, type(uint8).max);

    vm.assume(p.periodsInTerm % p.periodsPerInterestPeriod == 0);
    vm.assume(p.periodsInTerm % p.periodsPerPrincipalPeriod == 0);

    uint256 nPrincipalPeriods = p.periodsInTerm / p.periodsPerPrincipalPeriod;
    vm.assume(p.gracePrincipalPeriods < nPrincipalPeriods);

    _;
  }

  struct ScheduleParams {
    uint256 periodsInTerm;
    uint256 periodsPerInterestPeriod;
    uint256 periodsPerPrincipalPeriod;
    uint256 gracePrincipalPeriods;
  }
}

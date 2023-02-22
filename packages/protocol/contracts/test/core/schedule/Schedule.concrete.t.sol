// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract ConcreteScheduleTest is Test {
  IPeriodMapper internal m = new MonthlyPeriodMapper();
  Schedule internal s;

  PeriodExpectation[] internal expectations;

  uint256 internal startTime = 2390428800 - (24 * 60 * 60 * 15);
  uint256 internal periodsPerPrincipalPeriod = 6;
  uint256 internal periodsPerInterestPeriod = 3;
  uint256 internal periodsInTerm = 12;
  uint256 internal gracePrincipalPeriods = 1;

  function setUp() public {
    s = new Schedule(
      m,
      periodsInTerm,
      periodsPerPrincipalPeriod,
      periodsPerInterestPeriod,
      gracePrincipalPeriods
    );

    expectations.push(
      PeriodExpectation({
        startTime: 0,
        period: 0,
        interestPeriod: 0,
        principalPeriod: 0,
        previousDueTime: 0,
        nextDueTime: 2398377600,
        withinGracePeriod: true
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: s.termStartTime(startTime),
        period: 0,
        interestPeriod: 0,
        principalPeriod: 0,
        previousDueTime: 0,
        nextDueTime: 2398377600,
        withinGracePeriod: true
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2393107200, // Wed, 01 Nov 2045 00:00:00 GMT
        period: 1,
        interestPeriod: 0,
        principalPeriod: 0,
        previousDueTime: 0,
        nextDueTime: 2398377600,
        withinGracePeriod: true
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2395699200, // Fri, 01 Dec 2045 00:00:00 GMT
        period: 2,
        interestPeriod: 0,
        principalPeriod: 0,
        previousDueTime: 0,
        nextDueTime: 2398377600,
        withinGracePeriod: true
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2398377600, // Mon, 01 Jan 2046 00:00:00 GMT
        period: 3,
        interestPeriod: 1,
        principalPeriod: 0,
        previousDueTime: 2398377600,
        nextDueTime: 2406153600,
        withinGracePeriod: true
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2401056000, // Thu, 01 Feb 2046 00:00:00 GMT
        period: 4,
        interestPeriod: 1,
        principalPeriod: 0,
        previousDueTime: 2398377600,
        nextDueTime: 2406153600,
        withinGracePeriod: true
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2403475200, // Thu, 01 Mar 2046 00:00:00 GMT
        period: 5,
        interestPeriod: 1,
        principalPeriod: 0,
        previousDueTime: 2398377600,
        nextDueTime: 2406153600,
        withinGracePeriod: true
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2406153600, // Sun, 01 Apr 2046 00:00:00 GMT
        period: 6,
        interestPeriod: 2,
        principalPeriod: 0,
        previousDueTime: 2406153600,
        nextDueTime: 2414016000,
        withinGracePeriod: false
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2408745600, // Tue, 01 May 2046 00:00:00 GMT
        period: 7,
        interestPeriod: 2,
        principalPeriod: 0,
        previousDueTime: 2406153600,
        nextDueTime: 2414016000,
        withinGracePeriod: false
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2411424000, // Fri, 01 Jun 2046 00:00:00 GMT
        period: 8,
        interestPeriod: 2,
        principalPeriod: 0,
        previousDueTime: 2406153600,
        nextDueTime: 2414016000,
        withinGracePeriod: false
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2414016000, // Sun, 01 Jul 2046 00:00:00 GMT
        period: 9,
        interestPeriod: 3,
        principalPeriod: 0,
        previousDueTime: 2414016000,
        nextDueTime: s.termEndTime(startTime),
        withinGracePeriod: false
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2416694400, // Wed, 01 Aug 2046 00:00:00 GMT
        period: 10,
        interestPeriod: 3,
        principalPeriod: 0,
        previousDueTime: 2414016000,
        nextDueTime: s.termEndTime(startTime),
        withinGracePeriod: false
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2419372800, // Sat, 01 Sep 2046 00:00:00 GMT
        period: 11,
        interestPeriod: 3,
        principalPeriod: 0,
        previousDueTime: 2414016000,
        nextDueTime: s.termEndTime(startTime),
        withinGracePeriod: false
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2421964800, // Mon, 01 Oct 2046 00:00:00 GMT
        period: s.periodsInTerm(),
        interestPeriod: s.totalInterestPeriods(),
        principalPeriod: s.totalPrincipalPeriods(),
        nextDueTime: s.termEndTime(startTime),
        previousDueTime: s.termEndTime(startTime),
        withinGracePeriod: false
      })
    );
    expectations.push(
      PeriodExpectation({
        startTime: 2614032000, // Fri, 01 Nov 2052 00:00:00 GMT
        period: s.periodsInTerm(),
        interestPeriod: s.totalInterestPeriods(),
        principalPeriod: s.totalPrincipalPeriods(),
        nextDueTime: s.termEndTime(startTime),
        previousDueTime: s.termEndTime(startTime),
        withinGracePeriod: false
      })
    );
  }

  function testTermStartTime() public {
    assertEq(s.termStartTime(startTime), 2390428800);
  }

  function testTermEndTime() public {
    assertEq(s.termEndTime(startTime), 2421964800);
  }

  function testConcreteScheduleBehavesCorrectly() public {
    for (uint256 period = 0; period < expectations.length - 1; period++) {
      PeriodExpectation memory expectation = expectations[period];
      PeriodExpectation memory nextExpectation = expectations[period + 1];
      uint256 periodStartTime = expectation.startTime;
      uint256 periodEndTime = nextExpectation.startTime - 1;
      uint256 periodDuration = periodEndTime - periodStartTime;
      uint256 periodMidPoint = periodStartTime + periodDuration / 2;

      assertEq(s.periodAt(startTime, periodStartTime), expectation.period, "SP");
      assertEq(s.periodAt(startTime, periodMidPoint), expectation.period, "MP");
      assertEq(s.periodAt(startTime, periodEndTime), expectation.period, "EP");

      assertEq(s.interestPeriodAt(startTime, periodStartTime), expectation.interestPeriod, "SI");
      assertEq(s.interestPeriodAt(startTime, periodMidPoint), expectation.interestPeriod, "MI");
      assertEq(s.interestPeriodAt(startTime, periodEndTime), expectation.interestPeriod, "EI");

      assertEq(s.principalPeriodAt(startTime, periodStartTime), expectation.principalPeriod, "SPr");
      assertEq(s.principalPeriodAt(startTime, periodMidPoint), expectation.principalPeriod, "MPr");
      assertEq(s.principalPeriodAt(startTime, periodEndTime), expectation.principalPeriod, "EPr");

      assertEq(s.nextDueTimeAt(startTime, periodStartTime), expectation.nextDueTime, "SD");
      assertEq(s.nextDueTimeAt(startTime, periodMidPoint), expectation.nextDueTime, "MD");
      assertEq(s.nextDueTimeAt(startTime, periodEndTime), expectation.nextDueTime, "ED");

      assertEq(
        s.previousDueTimeAt(startTime, periodStartTime),
        expectation.previousDueTime,
        "SPre"
      );
      assertEq(s.previousDueTimeAt(startTime, periodMidPoint), expectation.previousDueTime, "MPre");
      assertEq(s.previousDueTimeAt(startTime, periodEndTime), expectation.previousDueTime, "EPre");

      assertEq(
        s.withinPrincipalGracePeriodAt(startTime, periodStartTime),
        expectation.withinGracePeriod
      );
      assertEq(
        s.withinPrincipalGracePeriodAt(startTime, periodMidPoint),
        expectation.withinGracePeriod
      );
      assertEq(
        s.withinPrincipalGracePeriodAt(startTime, periodEndTime),
        expectation.withinGracePeriod
      );
    }
  }
}

struct PeriodExpectation {
  uint256 startTime;
  uint256 period;
  uint256 interestPeriod;
  uint256 principalPeriod;
  uint256 nextDueTime;
  uint256 previousDueTime;
  bool withinGracePeriod;
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Test} from "forge-std/Test.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {MonthlyScheduleRepo} from "../../../protocol/core/schedule/MonthlyScheduleRepo.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

contract MonthlyScheduleRepoTest is Test {
  MonthlyScheduleRepo private repo;

  function setUp() public {
    repo = new MonthlyScheduleRepo();
  }

  function testGetScheduleRevertsIfScheduleDoesNotExist() public {
    vm.expectRevert("Schedule doesn't exist");
    repo.getSchedule({
      periodsInTerm: 12,
      periodsPerPrincipalPeriod: 12,
      periodsPerInterestPeriod: 1,
      gracePrincipalPeriods: 0
    });
  }

  function testGetScheduleReturnsScheduleIfScheduleExists() public {
    repo.createSchedule({
      periodsInTerm: 12,
      periodsPerPrincipalPeriod: 12,
      periodsPerInterestPeriod: 1,
      gracePrincipalPeriods: 0
    });
    Schedule s = Schedule(
      address(
        repo.getSchedule({
          periodsInTerm: 12,
          periodsPerPrincipalPeriod: 12,
          periodsPerInterestPeriod: 1,
          gracePrincipalPeriods: 0
        })
      )
    );
    // Verify the schedule parameters match
    assertEq(address(s.periodMapper()), address(repo.periodMapper()));
    assertEq(s.periodsInTerm(), 12);
    assertEq(s.periodsPerPrincipalPeriod(), 12);
    assertEq(s.periodsPerInterestPeriod(), 1);
    assertEq(s.gracePrincipalPeriods(), 0);
  }

  function testCreateScheduleReusesExistingSchedule() public {
    repo.createSchedule({
      periodsInTerm: 12,
      periodsPerPrincipalPeriod: 12,
      periodsPerInterestPeriod: 1,
      gracePrincipalPeriods: 0
    });

    ISchedule s1 = repo.getSchedule({
      periodsInTerm: 12,
      periodsPerPrincipalPeriod: 12,
      periodsPerInterestPeriod: 1,
      gracePrincipalPeriods: 0
    });

    // Create again with same params
    repo.createSchedule({
      periodsInTerm: 12,
      periodsPerPrincipalPeriod: 12,
      periodsPerInterestPeriod: 1,
      gracePrincipalPeriods: 0
    });

    ISchedule s2 = repo.getSchedule({
      periodsInTerm: 12,
      periodsPerPrincipalPeriod: 12,
      periodsPerInterestPeriod: 1,
      gracePrincipalPeriods: 0
    });

    // Schedules should be the same
    assertEq(address(s1), address(s2));
  }
}

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {MonthlyPeriodMapper} from "../../../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../../../protocol/core/schedule/Schedule.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";

contract CallableLoanInitializationTest is CallableLoanBaseTest {
  function testInitializationSetsCorrectTrancheDefaults() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();

    ITranchedPool.TrancheInfo memory junior = callableLoan.getTranche(2);
    assertEq(junior.principalSharePrice, UNIT_SHARE_PRICE);
    assertZero(junior.interestSharePrice);
    assertZero(junior.principalDeposited);
    assertZero(junior.lockedUntil);

    ITranchedPool.TrancheInfo memory senior = callableLoan.getTranche(1);
    assertEq(senior.principalSharePrice, UNIT_SHARE_PRICE);
    assertZero(senior.interestSharePrice);
    assertZero(senior.principalDeposited);
    assertZero(senior.lockedUntil);
  }

  function testInitializationGrantsProperRoles() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    assertTrue(callableLoan.hasRole(callableLoan.SENIOR_ROLE(), address(seniorPool)));
    assertTrue(callableLoan.hasRole(callableLoan.LOCKER_ROLE(), GF_OWNER));
    assertTrue(callableLoan.hasRole(callableLoan.LOCKER_ROLE(), BORROWER));
  }

  function testInitializationCantHappenTwice() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uint256[] memory uidTypes = new uint256[](1);
    ISchedule s = defaultSchedule();
    vm.expectRevert("Contract instance has already been initialized");
    callableLoan.initialize(address(gfConfig), BORROWER, 0, 0, 0, s, 0, block.timestamp, uidTypes);
  }

  function testCreditLineCannotBeReinitialized() public {
    (, CreditLine cl) = defaultCallableLoan();

    ISchedule s = defaultSchedule();
    vm.expectRevert("Contract instance has already been initialized");
    cl.initialize(address(gfConfig), GF_OWNER, BORROWER, 0, 0, s, 0);
  }

  function testGetAmountsOwedFailedForUninitializedCreditLine() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.expectRevert(bytes("LI"));
    callableLoan.getAmountsOwed(block.timestamp);
  }

  function defaultSchedule() public returns (ISchedule) {
    return
      createMonthlySchedule({
        periodsInTerm: 12,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 12,
        gracePrincipalPeriods: 0
      });
  }

  function createMonthlySchedule(
    uint periodsInTerm,
    uint periodsPerPrincipalPeriod,
    uint periodsPerInterestPeriod,
    uint gracePrincipalPeriods
  ) public returns (ISchedule) {
    return
      new Schedule({
        _periodMapper: new MonthlyPeriodMapper(),
        _periodsInTerm: periodsInTerm,
        _periodsPerInterestPeriod: periodsPerInterestPeriod,
        _periodsPerPrincipalPeriod: periodsPerPrincipalPeriod,
        _gracePrincipalPeriods: gracePrincipalPeriods
      });
  }
}

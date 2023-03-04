// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {IPeriodMapper} from "../../../interfaces/IPeriodMapper.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";

contract CallableLoanInitializationTest is CallableLoanBaseTest {
  function testInitializationGrantsProperRoles() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    assertTrue(callableLoan.hasRole(callableLoan.LOCKER_ROLE(), GF_OWNER));
    assertTrue(callableLoan.hasRole(callableLoan.LOCKER_ROLE(), BORROWER));
  }

  function testInitializationCantHappenTwice() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uint256[] memory uidTypes = new uint256[](1);
    ISchedule s = defaultSchedule();
    vm.expectRevert("Initializable: contract is already initialized");
    callableLoan.initialize(gfConfig, BORROWER, 0, 0, 2, s, 0, block.timestamp, uidTypes);
  }

  function testInitializationCantHappenViaCreditLine() public {
    ICreditLine cl = ICreditLine(new CallableLoan());

    ISchedule s = defaultSchedule();
    vm.expectRevert(bytes("US"));
    cl.initialize(address(gfConfig), GF_OWNER, BORROWER, 0, 0, s, 0);
  }

  function testInitializationCantHappenTwiceViaCreditLine() public {
    (, ICreditLine cl) = defaultCallableLoan();

    ISchedule s = defaultSchedule();
    vm.expectRevert("Initializable: contract is already initialized");
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
    uint256 periodsInTerm,
    uint256 periodsPerPrincipalPeriod,
    uint256 periodsPerInterestPeriod,
    uint256 gracePrincipalPeriods
  ) public returns (ISchedule) {
    IPeriodMapper pm = IPeriodMapper(deployCode("MonthlyPeriodMapper.sol"));
    return
      ISchedule(
        deployCode(
          "Schedule.sol",
          abi.encode(
            pm,
            periodsInTerm,
            periodsPerInterestPeriod,
            periodsPerPrincipalPeriod,
            gracePrincipalPeriods
          )
        )
      );
  }
}

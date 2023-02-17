// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanTermStartTimeTest is CallableLoanBaseTest {
  function testIsZeroBeforeFirstDrawdown() public {
    (, ICreditLine cl) = defaultCallableLoan();
    assertZero(cl.termStartTime());
  }

  function testIsSetToTimeOfFirstDrawdown() public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(callableLoan, 3, usdcVal(1_000_000), DEPOSITOR);
    drawdown(callableLoan, 100);

    ISchedule s = callableLoan.schedule();
    uint64 startTime = uint64(callableLoan.termStartTime());
    assertEq(cl.termStartTime(), s.termStartTime(startTime));
  }

  function testDoesntResetOnSubsequentZeroBalanceDrawdowns() public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(callableLoan, 3, usdcVal(1_000_000), DEPOSITOR);
    drawdown(callableLoan, 100);

    uint256 termStartTime = cl.termStartTime();

    // Advance to next payment period, fully pay back the loan, and drawdown again
    vm.warp(cl.nextDueTime());
    pay(callableLoan, cl.interestOwed() + cl.principalOwed() + cl.balance());

    assertZero(cl.interestOwed() + cl.principalOwed() + cl.balance());

    _startImpersonation(callableLoan.borrower());
    callableLoan.drawdown(usdcVal(100));

    // termStartTime should be the same
    assertEq(cl.termStartTime(), termStartTime);
  }
}

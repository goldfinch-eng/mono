// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanTermStartTimeTest is CallableLoanBaseTest {
  function testIsZeroBeforeFirstDrawdown() public {
    (, CreditLine cl) = defaultCallableLoan();
    assertZero(cl.termStartTime());
  }

  function testIsSetToTimeOfFirstDrawdown() public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(callableLoan, 2, usdcVal(1_000_000), DEPOSITOR);
    lockAndDrawdown(callableLoan, usdcVal(100));

    (ISchedule s, uint64 startTime) = cl.schedule();
    assertEq(cl.termStartTime(), s.termStartTime(startTime));
  }

  function testDoesntResetOnSubsequentZeroBalanceDrawdowns() public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(callableLoan, 2, usdcVal(1_000_000), DEPOSITOR);
    lockAndDrawdown(callableLoan, usdcVal(100));

    uint256 termStartTime = cl.termStartTime();

    // Advance to next payment period, fully pay back the loan, and drawdown again
    vm.warp(cl.nextDueTime());
    pay(callableLoan, cl.interestOwed() + cl.principalOwed() + cl.balance());

    assertZero(cl.interestOwed() + cl.principalOwed() + cl.balance());

    _startImpersonation(cl.borrower());
    callableLoan.drawdown(usdcVal(100));

    // termStartTime should be the same
    assertEq(cl.termStartTime(), termStartTime);
  }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ISchedule} from "../../../interfaces/ISchedule.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolTermStartTimeTest is TranchedPoolBaseTest {
  function testIsZeroBeforeFirstDrawdown() public {
    (, CreditLine cl) = defaultTranchedPool();
    assertZero(cl.termStartTime());
  }

  function testIsSetToTimeOfFirstDrawdown() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(pool, 2, usdcVal(1_000_000), DEPOSITOR);
    lockAndDrawdown(pool, usdcVal(100));

    (ISchedule s, uint64 startTime) = cl.schedule();
    assertEq(cl.termStartTime(), s.termStartTime(startTime));
  }

  function testDoesntResetOnSubsequentZeroBalanceDrawdowns() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(pool, 2, usdcVal(1_000_000), DEPOSITOR);
    lockAndDrawdown(pool, usdcVal(100));

    uint256 termStartTime = cl.termStartTime();

    // Advance to next payment period, fully pay back the loan, and drawdown again
    vm.warp(cl.nextDueTime());
    pay(pool, cl.interestOwed() + cl.principalOwed() + cl.balance());

    assertZero(cl.interestOwed() + cl.principalOwed() + cl.balance());

    _startImpersonation(cl.borrower());
    pool.drawdown(usdcVal(100));

    // termStartTime should be the same
    assertEq(cl.termStartTime(), termStartTime);
  }
}

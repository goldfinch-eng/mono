// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolTermStartTimeTest is TranchedPoolBaseTest {
  function testRevertsBeforeFirstDrawdown() public {
    (, CreditLine cl) = defaultTranchedPool();
    vm.expectRevert("Uninitialized");
    cl.termStartTime();
  }

  function testIsSetToTimeOfFirstDrawdown() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(pool, 2, usdcVal(1_000_000), DEPOSITOR);
    lockAndDrawdown(pool, usdcVal(100));

    assertEq(cl.termStartTime(), block.timestamp);
  }

  function testDoesntResetOnSubsequentZeroBalanceDrawdowns() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();

    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(pool, 2, usdcVal(1_000_000), DEPOSITOR);
    lockAndDrawdown(pool, usdcVal(100));

    uint256 termStartTime = cl.termStartTime();

    // Advance to next payment period, fully pay back the loan, and drawdown again
    vm.warp(block.timestamp + periodInSeconds(pool));
    pay(pool, cl.interestOwed() + cl.principalOwed() + cl.balance());

    assertZero(cl.interestOwed() + cl.principalOwed() + cl.balance());

    _startImpersonation(cl.borrower());
    pool.drawdown(usdcVal(100));

    // termStartTime should not have changed
    assertEq(cl.termStartTime(), termStartTime);
  }
}

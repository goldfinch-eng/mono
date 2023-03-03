// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

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
    assertEq(cl.termStartTime(), s.termStartTime(block.timestamp));
  }
}

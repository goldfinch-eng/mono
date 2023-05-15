// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanTermEndTimeTest is CallableLoanBaseTest {
  function testTermEndTimeIsSetOnFirstDrawdown(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    (CallableLoan callableLoan, ) = callableLoanBuilder.withLimit(amount).build(BORROWER);
    _startImpersonation(GF_OWNER);
    callableLoan.unpauseDrawdowns();

    assertZero(callableLoan.termEndTime());
    depositAndDrawdown(callableLoan, amount, GF_OWNER);
    // This is >= because of the creation of the stub period
    assertGe(callableLoan.termEndTime(), block.timestamp + termInSeconds(callableLoan));
  }

  function testTermEndTimeDoesNotChangeOnSubsequentDrawdown(uint256 drawdownAmount) public {
    drawdownAmount = bound(drawdownAmount, usdcVal(2), usdcVal(10_000_000));
    (CallableLoan callableLoan, ) = callableLoanBuilder.withLimit(drawdownAmount).build(BORROWER);
    _startImpersonation(GF_OWNER);
    callableLoan.unpauseDrawdowns();
    deposit(callableLoan, 3, drawdownAmount, DEPOSITOR);
    drawdown(callableLoan, drawdownAmount / 2);
    uint256 termEndTimeBefore = callableLoan.termEndTime();
    drawdown(callableLoan, drawdownAmount / 2);
    assertEq(callableLoan.termEndTime(), termEndTimeBefore);
  }

  function termInSeconds(CallableLoan callableLoan) internal returns (uint256) {
    return callableLoan.termEndTime() - callableLoan.termStartTime();
  }
}

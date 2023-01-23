// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanTermEndTimeTest is CallableLoanBaseTest {
  function testTermEndTimeIsSetOnFirstDrawdown(uint256 amount) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    setMaxLimit(callableLoan, amount * 5);

    assertZero(cl.termEndTime());
    fundAndDrawdown(callableLoan, amount, GF_OWNER);
    // This is >= because of the creation of the stub period
    assertGe(cl.termEndTime(), block.timestamp + termInSeconds(cl));
  }

  // TODO - bug when you drawdown multiple times!
  function testTermEndTimeDoesNotChangeOnSubsequentDrawdown(uint256 amount) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    amount = bound(amount, usdcVal(2), usdcVal(10_000_000));
    setMaxLimit(callableLoan, amount * 5);

    deposit(callableLoan, 2, amount, GF_OWNER);
    lockJuniorTranche(callableLoan);
    seniorDepositAndInvest(callableLoan, amount * 4);
    lockSeniorTranche(callableLoan);

    drawdown(callableLoan, amount);
    uint256 termEndTimeBefore = cl.termEndTime();
    drawdown(callableLoan, amount);
    assertEq(cl.termEndTime(), termEndTimeBefore);
  }

  function termInSeconds(CreditLine cl) internal returns (uint256) {
    return cl.termEndTime() - cl.termStartTime();
  }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanLastFullPaymentTimeTest is CallableLoanBaseTest {
  function testNotSetIfInterestPaymentLtInterestOwed(uint256 interestPayment) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    vm.warp(cl.nextDueTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, 1, cl.interestOwed() - 1);
    pay(callableLoan, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter, "lastFullPaymentTime unchanged");
  }

  function testSetToLastDueTimeIfFullInterestIsPaid(uint256 periodsToAdvance) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    periodsToAdvance = bound(periodsToAdvance, 1, 11);
    for (uint256 i = 0; i < periodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }
    uint256 expectedLastFullPaymentTime = block.timestamp;
    pay(callableLoan, cl.interestOwed());
    assertEq(cl.lastFullPaymentTime(), expectedLastFullPaymentTime);
  }

  function testNotSetWhenIfInterestButNotPrincipalPaidAfterTermEndTime(uint256 payment) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    vm.warp(cl.termEndTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    payment = bound(payment, cl.interestOwed(), cl.interestOwed() + cl.principalOwed() - 1);
    pay(callableLoan, payment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter);
  }

  function testSetIfInterestAndPrincipalPaidPastTermEndTime(uint256 secondsPastTermEndTime) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    secondsPastTermEndTime = bound(secondsPastTermEndTime, 0, 30 days * 50);
    vm.warp(cl.termEndTime() + secondsPastTermEndTime);

    pay(callableLoan, cl.interestOwed() + cl.principalOwed());
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testNotSetIfSeparateInterestPaymentLtInterestOwed(uint256 interestPayment) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    vm.warp(cl.nextDueTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, 1, cl.interestOwed() - 1);
    pay(callableLoan, 0, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter, "lastFullPaymentTime unchanged");
  }

  function testSetToBlockTimeInterestOwedIsPaidSeparate(
    uint256 interestPayment,
    uint256 periodsToAdvance
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    periodsToAdvance = bound(periodsToAdvance, 1, 11);
    for (uint256 i = 0; i < periodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }
    interestPayment = bound(interestPayment, cl.interestOwed(), usdcVal(10_000_000));
    pay(callableLoan, 0, interestPayment);
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testNotSetIfSeparateInterestButNotPrincipalPaidPastTermEndTime(
    uint256 interestPayment,
    uint256 principalPayment
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    vm.warp(cl.termEndTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, cl.interestOwed(), usdcVal(10_000_000));
    principalPayment = bound(principalPayment, 0, cl.principalOwed() - 1);
    pay(callableLoan, principalPayment, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter);
  }

  function testIfSeparateInterestAndPrincipalPaidPastTermEndTime(
    uint256 secondsPastTermEndTime
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    secondsPastTermEndTime = bound(secondsPastTermEndTime, 0, 30 days * 50);
    vm.warp(cl.termEndTime() + secondsPastTermEndTime);

    pay(callableLoan, cl.principalOwed(), cl.interestOwed());
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testSetToBlockTimeOnFirstDrawdown() public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testNotSetOnSecondDrawdownIfBalanceGt0(
    uint256 drawdownAmount,
    uint256 timestamp
  ) public {
    // Drawdown some amount less than the total available
    drawdownAmount = bound(drawdownAmount, usdcVal(1), usdcVal(499));

    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    uint256 expectedLastFullPaymentTime = cl.lastFullPaymentTime();

    // Advance to a future time where the borrower is still current on payments
    timestamp = bound(timestamp, block.timestamp, cl.nextDueTime());

    assertEq(cl.lastFullPaymentTime(), expectedLastFullPaymentTime);
  }

  function testSetToBlockTimeOnSecondDrawdownIfBalanceEq0(uint256 timestamp) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    pay(callableLoan, cl.interestOwed() + cl.principalOwed() + cl.balance());
    assertEq(cl.lastFullPaymentTime(), block.timestamp);

    timestamp = bound(timestamp, block.timestamp, cl.termEndTime() - 1);
    vm.warp(timestamp);

    drawdown(callableLoan, usdcVal(400));
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }
}

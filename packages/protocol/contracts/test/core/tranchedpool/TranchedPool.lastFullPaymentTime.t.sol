// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolLastFullPaymentTimeTest is TranchedPoolBaseTest {
  function testNotSetIfInterestPaymentLtInterestOwed(uint256 interestPayment) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    vm.warp(cl.nextDueTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, 1, cl.interestOwed() - 1);
    pay(pool, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter, "lastFullPaymentTime unchanged");
  }

  function testSetToLastDueTimeIfFullInterestIsPaid(uint256 periodsToAdvance) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    periodsToAdvance = bound(periodsToAdvance, 1, 11);
    for (uint256 i = 0; i < periodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }
    uint256 expectedLastFullPaymentTime = block.timestamp;
    pay(pool, cl.interestOwed());
    assertEq(cl.lastFullPaymentTime(), expectedLastFullPaymentTime);
  }

  function testNotSetWhenIfInterestButNotPrincipalPaidAfterTermEndTime(uint256 payment) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    vm.warp(cl.termEndTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    payment = bound(payment, cl.interestOwed(), cl.interestOwed() + cl.principalOwed() - 1);
    pay(pool, payment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter);
  }

  function testSetIfInterestAndPrincipalPaidPastTermEndTime(uint256 secondsPastTermEndTime) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    secondsPastTermEndTime = bound(secondsPastTermEndTime, 0, periodInSeconds(pool) * 50);
    vm.warp(cl.termEndTime() + secondsPastTermEndTime);

    pay(pool, cl.interestOwed() + cl.principalOwed());
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testNotSetIfSeparateInterestPaymentLtInterestOwed(uint256 interestPayment) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    vm.warp(cl.nextDueTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, 1, cl.interestOwed() - 1);
    pay(pool, 0, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter, "lastFullPaymentTime unchanged");
  }

  function testSetToBlockTimeInterestOwedIsPaidSeparate(
    uint256 interestPayment,
    uint256 periodsToAdvance
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    periodsToAdvance = bound(periodsToAdvance, 1, 11);
    for (uint256 i = 0; i < periodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }
    interestPayment = bound(interestPayment, cl.interestOwed(), usdcVal(10_000_000));
    pay(pool, 0, interestPayment);
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testNotSetIfSeparateInterestButNotPrincipalPaidPastTermEndTime(
    uint256 interestPayment,
    uint256 principalPayment
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    vm.warp(cl.termEndTime());
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, cl.interestOwed(), usdcVal(10_000_000));
    principalPayment = bound(principalPayment, 0, cl.principalOwed() - 1);
    pay(pool, principalPayment, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(lastFullPaymentTimeBefore, lastFullPaymentTimeAfter);
  }

  function testIfSeparateInterestAndPrincipalPaidPastTermEndTime(
    uint256 secondsPastTermEndTime
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    secondsPastTermEndTime = bound(secondsPastTermEndTime, 0, periodInSeconds(pool) * 50);
    vm.warp(cl.termEndTime() + secondsPastTermEndTime);

    pay(pool, cl.principalOwed(), cl.interestOwed());
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testSetToBlockTimeOnFirstDrawdown() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }

  function testNotSetOnSecondDrawdownIfBalanceGt0(
    uint256 drawdownAmount,
    uint256 timestamp
  ) public {
    // Drawdown some amount less than the total available
    drawdownAmount = bound(drawdownAmount, usdcVal(1), usdcVal(499));

    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, drawdownAmount);

    uint256 expectedLastFullPaymentTime = cl.lastFullPaymentTime();

    // Advance to a future time where the borrower is still current on payments
    timestamp = bound(timestamp, block.timestamp, cl.nextDueTime());

    drawdown(pool, usdcVal(500) - drawdownAmount - 1);
    assertEq(cl.lastFullPaymentTime(), expectedLastFullPaymentTime);
  }

  function testSetToBlockTimeOnSecondDrawdownIfBalanceEq0(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    pay(pool, cl.interestOwed() + cl.principalOwed() + cl.balance());
    assertEq(cl.lastFullPaymentTime(), block.timestamp);

    timestamp = bound(timestamp, block.timestamp, cl.termEndTime() - 1);
    vm.warp(timestamp);

    drawdown(pool, usdcVal(500));
    assertEq(cl.lastFullPaymentTime(), block.timestamp);
  }
}

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";

contract TranchedPoolV2LastFullPaymentTimeTest is TranchedPoolV2BaseTest {
  function testLastFullPaymentTimeNotSetWhenInterestPaymentIsLessThanInterestOwed(
    uint256 interestPayment
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
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

  function testLastFullPaymentTimeIsSetToLastDueTimeAfterFullInterestIsPaid(
    uint256 interestPayment,
    uint256 periodsToAdvance
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    periodsToAdvance = bound(periodsToAdvance, 1, 12);
    for (uint256 i = 0; i < periodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, cl.interestOwed(), cl.balance() + cl.interestOwed());
    pay(pool, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(
      lastFullPaymentTimeBefore + periodInSeconds(pool) * periodsToAdvance,
      lastFullPaymentTimeAfter
    );
  }

  function testLastFullPaymentTimeNotSetWhenIPayInterestButNotPrincipalPastTermEndTime(
    uint256 payment
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
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

  function testLastFullPaymentTimeSetWhenIPayInterestAndPrincipalPastTermEndTime(
    uint256 secondsPastTermEndTime
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    secondsPastTermEndTime = bound(secondsPastTermEndTime, 0, periodInSeconds(pool) * 50);
    vm.warp(cl.termEndTime() + secondsPastTermEndTime);

    pay(pool, cl.interestOwed() + cl.principalOwed());
    assertEq(cl.lastFullPaymentTime(), cl.termEndTime());
  }

  function testLastFullPaymentTimeNotSetWhenSeparateInterestPaymentIsLessThanInterestOwed(
    uint256 interestPayment
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
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

  function testLastFullPaymentTimeIsSetToLastDueTimeAfterlInterestOwedIsPaidSeparate(
    uint256 interestPayment,
    uint256 periodsToAdvance
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));
    periodsToAdvance = bound(periodsToAdvance, 1, 12);
    for (uint256 i = 0; i < periodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }
    uint256 lastFullPaymentTimeBefore = cl.lastFullPaymentTime();
    interestPayment = bound(interestPayment, cl.interestOwed(), usdcVal(10_000_000));
    pay(pool, 0, interestPayment);
    uint256 lastFullPaymentTimeAfter = cl.lastFullPaymentTime();
    assertEq(
      lastFullPaymentTimeBefore + periodInSeconds(pool) * periodsToAdvance,
      lastFullPaymentTimeAfter
    );
  }

  function testLastFullPaymentTimeNotSetWhenPayingSeparateInterestButNotPrincipalPastTermEndTime(
    uint256 interestPayment,
    uint256 principalPayment
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
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

  function testLastFullPaymentTimeSetWhenIPaySeparateInterestAndPrincipalPastTermEndTime(
    uint256 secondsPastTermEndTime
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    deposit(pool, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, usdcVal(400));
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(500));

    secondsPastTermEndTime = bound(secondsPastTermEndTime, 0, periodInSeconds(pool) * 50);
    vm.warp(cl.termEndTime() + secondsPastTermEndTime);

    pay(pool, cl.principalOwed(), cl.interestOwed());
    assertEq(cl.lastFullPaymentTime(), cl.termEndTime());
  }
}

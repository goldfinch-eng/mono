// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

import {TranchedPoolBaseTest} from "../BaseTranchedPool.t.sol";

/**
 * Testing paySeparate when
 * (intOwed > 0, intAccrued = 0, principalOwed = 0)
 * Case 1. intOwed not paid
 *  Case i. princPayment = 0 ==> ACCEPT
 *  Case ii. princPayment > 0 ==> REJECT
 * Case 2. intOwed paid
 *  ACCEPT all payments
 */
contract TranchedPoolPaySeparateIntOwedGt0IntAccrEq0PrincOwedEq0 is TranchedPoolBaseTest {
  TranchedPool private tp;
  CreditLine private cl;

  function setUp() public override {
    super.setUp();

    (tp, cl) = defaultTranchedPool();
    deposit(tp, 2, usdcVal(100), GF_OWNER);
    lockJuniorTranche(tp);
    seniorDepositAndInvest(tp, usdcVal(400));
    lockSeniorTranche(tp);
    drawdown(tp, usdcVal(500));

    fundAddress(address(this), usdcVal(2000));
    usdc.approve((address(tp)), usdcVal(2000));
  }

  function testIntOwedNotPaidAcceptPrincPaymentEq0(
    uint256 intPayment,
    uint256 numPeriodsToAdvance
  ) public {
    numPeriodsToAdvance = bound(numPeriodsToAdvance, 1, 11);
    for (uint i = 0; i < numPeriodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }

    vm.assume(cl.interestAccrued() == 0);
    vm.assume(cl.interestOwed() > 1);
    vm.assume(cl.principalOwed() == 0);

    intPayment = bound(intPayment, 1, cl.interestOwed() - 1);
    ITranchedPool.PaymentAllocation memory pa = tp.pay(0, intPayment);

    assertEq(pa.owedInterestPayment, intPayment);
    assertZero(pa.accruedInterestPayment);
    assertZero(pa.principalPayment);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testIntOwedNotPaidRejectPrincPaymentGt0(
    uint256 intPayment,
    uint256 princPayment,
    uint256 numPeriodsToAdvance
  ) public {
    numPeriodsToAdvance = bound(numPeriodsToAdvance, 1, 11);
    for (uint i = 0; i < numPeriodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }

    vm.assume(cl.interestAccrued() == 0);
    vm.assume(cl.interestOwed() > 1);
    vm.assume(cl.principalOwed() == 0);

    intPayment = bound(intPayment, 1, cl.interestOwed() - 1);
    princPayment = bound(princPayment, 1, usdcVal(1000));

    vm.expectRevert(bytes("IO"));
    tp.pay(princPayment, intPayment);
  }

  function testIntOwedPaidAcceptPrincPaymentGte0(
    uint256 intPayment,
    uint256 princPayment,
    uint256 numPeriodsToAdvance
  ) public {
    numPeriodsToAdvance = bound(numPeriodsToAdvance, 1, 11);
    for (uint i = 0; i < numPeriodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }

    vm.assume(cl.interestAccrued() == 0);
    vm.assume(cl.interestOwed() > 0);
    vm.assume(cl.principalOwed() == 0);

    uint256 intOwed = cl.interestOwed();
    intPayment = bound(intPayment, intOwed, usdcVal(1000));
    princPayment = bound(princPayment, 1, usdcVal(1000));
    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intPayment);

    assertEq(pa.owedInterestPayment, intOwed);
    assertZero(pa.accruedInterestPayment);
    assertZero(pa.principalPayment);
    assertEq(pa.additionalBalancePayment, Math.min(princPayment, usdcVal(500)));
    assertZero(pa.paymentRemaining);
  }
}

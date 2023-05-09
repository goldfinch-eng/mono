// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

import {TranchedPoolBaseTest} from "../BaseTranchedPool.t.sol";

/**
 * Testing paySeparate when
 * (interestOwed > 0, intAccrued = 0, principalOwed > 0)
 * Case 1. intOwed not fully paid
 *  Case i. princPayment = 0 ==> ACCEPT
 *  Case ii. princPayment > 0 ==> REJECT
 * Case 2. intOwed fully paid
 *  Case i. princPayment >= 0 ==> ACCEPT
 */
contract TranchedPoolPaySeparateIntOwedGt0IntAccrEq0PrincOwedGt0 is TranchedPoolBaseTest {
  TranchedPool private tp;
  CreditLine private cl;

  function setUp() public override {
    super.setUp();

    (tp, cl) = tranchedPoolWithMonthlyPrincipalSchedule();
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
    numPeriodsToAdvance = bound(numPeriodsToAdvance, 1, 12);
    for (uint i = 0; i < numPeriodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }

    vm.assume(cl.principalOwed() > 0);
    vm.assume(cl.interestOwed() > 1);
    vm.assume(cl.interestAccrued() == 0);

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
    numPeriodsToAdvance = bound(numPeriodsToAdvance, 1, 12);
    for (uint i = 0; i < numPeriodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }

    vm.assume(cl.principalOwed() > 0);
    vm.assume(cl.interestOwed() > 1);
    vm.assume(cl.interestAccrued() == 0);

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
    numPeriodsToAdvance = bound(numPeriodsToAdvance, 1, 12);
    for (uint i = 0; i < numPeriodsToAdvance; ++i) {
      vm.warp(cl.nextDueTime());
    }
    vm.assume(cl.principalOwed() > 0);
    vm.assume(cl.interestOwed() > 0);
    vm.assume(cl.interestAccrued() == 0);

    uint256 intOwed = cl.interestOwed();
    intPayment = bound(intPayment, cl.interestOwed(), usdcVal(1000));
    princPayment = bound(princPayment, 0, usdcVal(1000));
    uint256 princOwedPayment = Math.min(princPayment, cl.principalOwed());
    uint256 remainingPayment = princPayment - princOwedPayment;
    uint256 remainingBalance = cl.balance() - princOwedPayment;

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intPayment);

    assertEq(pa.owedInterestPayment, intOwed);
    assertZero(pa.accruedInterestPayment);
    assertEq(pa.principalPayment, princOwedPayment);
    assertEq(pa.additionalBalancePayment, Math.min(remainingBalance, remainingPayment));
    assertZero(pa.paymentRemaining);
  }
}

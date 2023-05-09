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
 * (intOwed = 0 && intAcc > 0 && princOwed > 0)
 * Case 1. princOwed not fully paid
 *  Case i. intPayment = 0 ==> ACCEPT
 *  Case ii. intPayment > 0 ==> REJECT
 * Case 2. princOwed fully paid, intAcc not fully paid
 *  Case i. princPayment = 0 ==> ACCEPT
 *  Case ii. princPayment > 0 ==> REJECT
 * Case 3. princOwed fully paid
 *  ACCEPT all payment amounts
 */
contract TranchedPoolPaySeparateIntOwedEq0IntAccGt0PrincOwedGt0 is TranchedPoolBaseTest {
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

  function testPrincOwedNotPaidAcceptIntPaymentEq0(uint256 princPayment, uint256 timestamp) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // Pay off interest owed
    tp.pay(0, cl.interestOwed());

    vm.assume(cl.interestAccrued() > 0);
    vm.assume(cl.principalOwed() > 0);

    princPayment = bound(princPayment, 1, cl.principalOwed() - 1);

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, 0);

    assertZero(pa.owedInterestPayment);
    assertZero(pa.accruedInterestPayment);
    assertEq(pa.principalPayment, princPayment);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testPrincOwedNotPaidRejectIntPaymentGt0(
    uint256 princPayment,
    uint256 intPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // Pay off interest owed
    tp.pay(0, cl.interestOwed());

    vm.assume(cl.interestAccrued() > 0);
    vm.assume(cl.principalOwed() > 0);

    intPayment = bound(intPayment, 1, usdcVal(1000));
    princPayment = bound(princPayment, 1, cl.principalOwed() - 1);

    vm.expectRevert(bytes("PO"));
    tp.pay(princPayment, intPayment);
  }

  function testPrincOwedPaidIntAccNotPaidAcceptPrincPaymentEqPrincOwed(
    uint256 intPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // Pay off interest owed
    tp.pay(0, cl.interestOwed());

    vm.assume(cl.interestAccrued() > 0);
    vm.assume(cl.principalOwed() > 0);

    uint256 princOwed = cl.principalOwed();
    intPayment = bound(intPayment, 0, cl.interestAccrued());

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princOwed, intPayment);

    assertZero(pa.owedInterestPayment);
    assertEq(pa.accruedInterestPayment, intPayment);
    assertEq(pa.principalPayment, princOwed);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testPrincOwedPaidIntAccNotPaidRejectPrincPaymentGtPrincOwed(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // Pay off interest owed
    tp.pay(0, cl.interestOwed());

    vm.assume(cl.interestAccrued() > 1);
    vm.assume(cl.principalOwed() > 0);

    intPayment = bound(intPayment, 0, cl.interestAccrued() - 1);
    princPayment = bound(princPayment, cl.principalOwed() + 1, usdcVal(1000));

    vm.expectRevert(bytes("AI"));
    tp.pay(princPayment, intPayment);
  }

  function testPrincOwedPaidIntAccPaidAccept(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // Pay off interest owed
    tp.pay(0, cl.interestOwed());

    vm.assume(cl.interestAccrued() > 0);
    vm.assume(cl.principalOwed() > 0);

    uint256 intAcc = cl.interestAccrued();
    intPayment = bound(intPayment, intAcc, usdcVal(1000));

    uint256 princOwed = cl.principalOwed();
    princPayment = bound(princPayment, cl.principalOwed(), usdcVal(1000));

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intPayment);

    assertZero(pa.owedInterestPayment);
    assertEq(pa.accruedInterestPayment, intAcc);
    assertEq(pa.principalPayment, princOwed);
    uint256 totalPrincipalPayment = Math.min(princPayment, usdcVal(500));
    uint256 paymentAfterOwed = totalPrincipalPayment - princOwed;
    uint256 balanceAfterPrincOwed = usdcVal(500) - princOwed;
    uint256 additionalBalancePayment = Math.min(paymentAfterOwed, balanceAfterPrincOwed);
    assertEq(pa.additionalBalancePayment, additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import {SaturatingSub} from "../../../../protocol/library/SaturatingSub.sol";

import {TranchedPoolBaseTest} from "../BaseTranchedPool.t.sol";

/**
 * Testing paySeparate when
 * (interestOwed > 0, interestAccrued > 0, principalOwed > 0)
 * Case 1. interestOwed not fully paid
 *  Case i. principalPayment = 0 ==> ACCEPT
 *  Case ii. principalPayment > 0 ==> REJECT - cannot pay principal owed before paying off interest
 * Case 2. interestOwed fully paid, principalOwed not fully paid
 *  Case i. interestPayment = interestOwed ==> ACCEPT
 *  Case ii. interestPayment > interestOwed ==> REJECT - cannot pay interestAccrued before paying off principal
 * Case 3. interestOwed fully paid, principalOwed fully paid, interest accrued not fully paid
 *  Case i. principalPayment = principalOwed ==> ACCEPT
 *  Case ii. principalPayment > principalOwed ==> REJECT - cannot pay balance before paying interest accrued
 * Case 4. interestOwed fully paid, principalOWed fully paid, interest accrued fully paid
 * Case i. principalPayment >= principalOwed ==> ACCEPT
 */
contract TranchedPoolPaySeparateIntOwedGt0IntAccrGt0PrincOwedGt0 is TranchedPoolBaseTest {
  using SafeMathUpgradeable for uint256;
  using SaturatingSub for uint256;

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

  function testIntOwedNotFullyPaidAcceptPrincPaymenyEq0(
    uint256 intPayment,
    uint256 timestamp
  ) public {
    advanceTime(timestamp);

    vm.assume(cl.interestOwed() > 1);
    intPayment = bound(intPayment, 1, cl.interestOwed() - 1);
    ITranchedPool.PaymentAllocation memory pa = tp.pay(0, intPayment);

    assertEq(pa.owedInterestPayment, intPayment);
    assertZero(pa.accruedInterestPayment);
    assertZero(pa.principalPayment);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testIntOwedNotFullyPaidRejectPrincPaymentGt0(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    advanceTime(timestamp);

    vm.assume(cl.interestOwed() > 1);
    intPayment = bound(intPayment, 1, cl.interestOwed() - 1);
    princPayment = bound(princPayment, 1, usdcVal(1000));

    vm.expectRevert(bytes("IO"));
    tp.pay(princPayment, intPayment);
  }

  function testIntOwedPaidPrincOwedNotPaidAcceptIntPaymentEqIntOwed(
    uint256 princPayment,
    uint256 timestamp
  ) public {
    advanceTime(timestamp);

    princPayment = bound(princPayment, 1, cl.principalOwed() - 1);
    uint256 intOwed = cl.interestOwed();
    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intOwed);

    assertEq(pa.owedInterestPayment, intOwed);
    assertZero(pa.accruedInterestPayment);
    assertEq(pa.principalPayment, princPayment);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testIntOwedPaidPrincOwedNotPaidRejectIntPaymentGtIntOwed(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    advanceTime(timestamp);

    intPayment = bound(intPayment, cl.interestOwed() + 1, usdcVal(1000));
    princPayment = bound(princPayment, 1, cl.principalOwed() - 1);

    vm.expectRevert(bytes("PO"));
    tp.pay(princPayment, intPayment);
  }

  function testIntOwedPaidPrincOwedPaidIntAccNotPaidAcceptPrincPaymentEqPrincOwed(
    uint256 intPayment,
    uint256 timestamp
  ) public {
    advanceTime(timestamp);

    uint256 intOwed = cl.interestOwed();
    uint256 intAcc = cl.interestAccrued();
    uint256 princOwed = cl.principalOwed();
    intPayment = bound(intPayment, intOwed, intOwed + intAcc - 1);

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princOwed, intPayment);

    assertEq(pa.owedInterestPayment, intOwed);
    assertEq(pa.accruedInterestPayment, intPayment - intOwed);
    assertEq(pa.principalPayment, princOwed);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testIntOwedPaidPrincOwedPAidIntAccNotPaidRejectPrincPaymentGtPrincOwed(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    advanceTime(timestamp);

    uint256 intOwed = cl.interestOwed();
    uint256 intAcc = cl.interestAccrued();
    uint256 princOwed = cl.principalOwed();
    intPayment = bound(intPayment, intOwed, intOwed + intAcc - 1);
    princPayment = bound(princPayment, princOwed + 1, usdcVal(1000));

    vm.expectRevert(bytes("AI"));
    tp.pay(princPayment, intPayment);
  }

  function testIntOwedPaidPrincOwedPaidIntAccPaidAcceptAllPrincipalPayments(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    advanceTime(timestamp);

    uint256 intOwed = cl.interestOwed();
    uint256 intAcc = cl.interestAccrued();
    uint256 princOwed = cl.principalOwed();
    intPayment = bound(intPayment, intOwed + intAcc, usdcVal(1000));
    princPayment = bound(princPayment, princOwed, usdcVal(1000));

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princOwed, intPayment);

    assertEq(pa.owedInterestPayment, intOwed);
    assertEq(pa.accruedInterestPayment, intAcc);
    assertEq(pa.principalPayment, princOwed);
    assertEq(
      pa.additionalBalancePayment,
      usdcVal(500).saturatingSub(princPayment).saturatingSub(usdcVal(500) - princOwed)
    );
    assertZero(pa.paymentRemaining);
  }

  function advanceTime(uint256 timestamp) private {
    // Advance to a time such that intOwed > 0 && intAcc > 0 && princOwed > 0
    timestamp = bound(timestamp, cl.nextDueTime() + 1, cl.termEndTime() - 1 days);
    vm.warp(timestamp);
    vm.assume(cl.interestAccrued() > 0);
    assertTrue(cl.principalOwed() > 0);
    assertTrue(cl.interestOwed() > 0);
  }
}

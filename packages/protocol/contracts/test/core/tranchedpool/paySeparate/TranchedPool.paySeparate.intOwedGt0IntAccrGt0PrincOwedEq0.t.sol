// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {ISchedule} from "../../../../interfaces/ISchedule.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

import {TranchedPoolBaseTest} from "../BaseTranchedPool.t.sol";

/**
 * Testing paySeparate when
 * (intOwed > 0, intAccrued > 0, princOwed = 0)
 * Case 1. intOwed not fully paid
 *  Case i. princPayment = 0 ==> ACCEPT
 *  Case ii. princPayment > 0 ==> REJECT
 * Case 2. intAcc not fully paid
 *  Case i. princPayment = 0 ==> ACCEPT
 *  Case ii. princPayment > 0 ==> REJECT
 * Case 3. intOwed and intAcc fully paid
 *  ACCEPT all payments
 */
contract TranchedPoolPaySeparateIntOwedGt0IntAccrGt0PrincOwedEq0 is TranchedPoolBaseTest {
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

  function testIntOwedNotPaidAcceptPrincPaymentEq0(uint256 intPayment, uint256 timestamp) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // We want interestAccr > 0, so filter out timestamps that map exactly to a due time
    vm.assume(cl.interestAccrued() > 0);

    assertTrue(cl.interestOwed() > 1);
    assertZero(cl.principalOwed());

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
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // We want interestAccr > 0, so filter out timestamps that map exactly to a due time
    vm.assume(cl.interestAccrued() > 0);

    assertTrue(cl.interestOwed() > 1);
    assertZero(cl.principalOwed());

    intPayment = bound(intPayment, 1, cl.interestOwed() - 1);
    princPayment = bound(princPayment, 1, usdcVal(1000));

    vm.expectRevert(bytes("IO"));
    tp.pay(princPayment, intPayment);
  }

  function testIntAccrNotPaidAcceptPrincPaymentEq0(uint256 intPayment, uint256 timestamp) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // We want interestAccr > 0, so filter out timestamps that map exactly to a due time
    vm.assume(cl.interestAccrued() > 0);

    assertTrue(cl.interestOwed() > 0);
    assertZero(cl.principalOwed());

    uint256 intOwed = cl.interestOwed();
    vm.assume(cl.interestAccrued() > 0);
    intPayment = bound(intPayment, intOwed, intOwed + cl.interestAccrued() - 1);

    ITranchedPool.PaymentAllocation memory pa = tp.pay(0, intPayment);

    assertEq(pa.owedInterestPayment, intOwed);
    assertEq(pa.accruedInterestPayment, intPayment - intOwed);
    assertZero(pa.principalPayment);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testIntAccrNotPaidRejectPrincPaymentGt0(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // We want interestAccr > 0, so filter out timestamps that map exactly to a due time
    vm.assume(cl.interestAccrued() > 0);

    assertTrue(cl.interestOwed() > 0);
    assertZero(cl.principalOwed());

    vm.assume(cl.interestAccrued() > 0);
    intPayment = bound(intPayment, cl.interestOwed(), cl.interestOwed() + cl.interestAccrued() - 1);
    princPayment = bound(princPayment, 1, usdcVal(1000));

    vm.expectRevert(bytes("AI"));
    tp.pay(princPayment, intPayment);
  }

  function testIntAccrPaidAcceptPrincPaymentGte0(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, cl.nextDueTime() + 1 days, cl.termEndTime() - 1);
    vm.warp(timestamp);

    // We want interestAccr > 0, so filter out timestamps that map exactly to a due time
    vm.assume(cl.interestAccrued() > 0);

    assertTrue(cl.interestOwed() > 0);
    assertZero(cl.principalOwed());

    uint256 intOwed = cl.interestOwed();
    uint256 intAccr = cl.interestAccrued();
    intPayment = bound(intPayment, intOwed + intAccr, intOwed + intAccr + usdcVal(1000));
    princPayment = bound(princPayment, 0, usdcVal(1000));

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intPayment);

    assertEq(pa.owedInterestPayment, intOwed);
    assertEq(pa.accruedInterestPayment, intAccr);
    assertZero(pa.principalPayment);
    assertEq(pa.additionalBalancePayment, Math.min(usdcVal(500), princPayment));
    assertZero(pa.paymentRemaining);
  }
}

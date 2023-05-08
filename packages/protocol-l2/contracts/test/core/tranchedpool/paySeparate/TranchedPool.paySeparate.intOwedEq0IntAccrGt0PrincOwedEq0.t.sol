// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

import {TranchedPoolBaseTest} from "../BaseTranchedPool.t.sol";

/**
 * Testing paySeparate when
 * (interestOwed = 0 && interestAccrued > 0 && principalOwed = 0)
 * Case 1. intAcc not fully paid
 *  Case i. princPayment = 0 ==> ACCEPT
 *  Case ii. princPayment > 0 ==> REJECT
 * Case 2. intAcc fully paid
 *  Case i. princPayment >= 0 ==> ACCEPT
 */
contract TranchedPoolPaySeparateIntOwedEq0IntAccrGt0PrincOwedEq0 is TranchedPoolBaseTest {
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

  function testIntAccNotPaidAcceptPrincPaymentEq0(uint256 intPayment, uint256 timestamp) public {
    timestamp = bound(timestamp, block.timestamp + 1 days, cl.nextDueTime() - 1);

    vm.warp(timestamp);

    vm.assume(cl.interestAccrued() > 1);
    vm.assume(cl.interestOwed() == 0);
    vm.assume(cl.principalOwed() == 0);

    intPayment = bound(intPayment, 1, cl.interestAccrued() - 1);

    ITranchedPool.PaymentAllocation memory pa = tp.pay(0, intPayment);

    assertZero(pa.owedInterestPayment);
    assertEq(pa.accruedInterestPayment, intPayment);
    assertZero(pa.principalPayment);
    assertZero(pa.additionalBalancePayment);
    assertZero(pa.paymentRemaining);
  }

  function testIntAccNotPaidRejectPrincPaymentGt0(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, block.timestamp + 1 days, cl.nextDueTime() - 1);

    vm.warp(timestamp);

    vm.assume(cl.interestAccrued() > 1);
    vm.assume(cl.interestOwed() == 0);
    vm.assume(cl.principalOwed() == 0);

    intPayment = bound(intPayment, 1, cl.interestAccrued() - 1);
    princPayment = bound(princPayment, 1, usdcVal(1000));

    vm.expectRevert(bytes("AI"));
    tp.pay(princPayment, intPayment);
  }

  function testIntAccPaidAcceptPrincPaymentGte0(
    uint256 intPayment,
    uint256 princPayment,
    uint256 timestamp
  ) public {
    timestamp = bound(timestamp, block.timestamp + 1 days, cl.nextDueTime() - 1);
    vm.warp(timestamp);
    vm.assume(cl.interestAccrued() > 0);
    vm.assume(cl.interestOwed() == 0);
    vm.assume(cl.principalOwed() == 0);

    uint256 intAcc = cl.interestAccrued();
    intPayment = bound(intPayment, intAcc, usdcVal(1000));
    princPayment = bound(princPayment, 0, usdcVal(1000));

    ITranchedPool.PaymentAllocation memory pa = tp.pay(princPayment, intPayment);

    assertZero(pa.owedInterestPayment);
    assertEq(pa.accruedInterestPayment, intAcc);
    assertZero(pa.principalPayment);
    assertEq(pa.additionalBalancePayment, Math.min(princPayment, usdcVal(500)));
    assertZero(pa.paymentRemaining);
  }
}

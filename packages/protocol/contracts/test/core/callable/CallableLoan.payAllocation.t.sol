// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanPaySeparateTest is CallableLoanBaseTest {
  function testOnlyTakesWhatsNeededForExcessInterestPayment(
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwed() + cl.interestAccrued();
    interestAmount = bound(interestAmount, totalIntOwed, totalIntOwed * 10);

    fundAddress(address(this), interestAmount);
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.approve(address(callableLoan), interestAmount);
    callableLoan.pay(interestAmount);

    // Balance should only decrease by total interest owed even if that is less than the amount paid
    assertEq(usdc.balanceOf(address(this)), balanceBefore - totalIntOwed);
  }

  function testOnlyTakesWhatsNeededForExcessInterestAndPrincipalPayment(
    uint256 principalAmount,
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwed() + cl.interestAccrued();
    interestAmount = bound(interestAmount, totalIntOwed, totalIntOwed * 10);

    uint256 totalPrincipalOwed = cl.balance();
    principalAmount = bound(principalAmount, totalPrincipalOwed, totalPrincipalOwed * 10);

    uint256 totalOwed = totalIntOwed + totalPrincipalOwed;

    fundAddress(address(this), totalOwed);
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.approve(address(callableLoan), totalOwed);
    callableLoan.pay(principalAmount + interestAmount);

    // Balance should only decrease by total  owed even if that is less than the amount paid
    assertEq(usdc.balanceOf(address(this)), balanceBefore - totalOwed);
  }

  function testAcceptsPaymentUpToTotalInterestOwed(
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwed() + cl.interestAccrued();
    interestAmount = bound(interestAmount, 1, totalIntOwed);

    uint256 interestAccruedBefore = cl.interestAccrued();
    uint256 interestOwedBefore = cl.interestOwed();

    fundAddress(address(this), interestAmount);
    usdc.approve(address(callableLoan), interestAmount);
    ILoan.PaymentAllocation memory pa = callableLoan.pay(interestAmount);

    assertEq(cl.interestAccrued(), interestAccruedBefore - pa.accruedInterestPayment);
    assertEq(cl.interestOwed(), interestOwedBefore - pa.owedInterestPayment);
  }

  function testAcceptsPaymentUpToFutureGuaranteedInterestAndPrincipalOwed(
    uint256 principalAmount,
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 totalIntOwed = cl.interestOwedAt(callableLoan.nextPrincipalDueTime()) +
      cl.interestAccruedAt(callableLoan.nextPrincipalDueTime());
    principalAmount = bound(principalAmount, 0, cl.balance());

    uint256 interestAccruedBefore = cl.interestAccrued();
    uint256 interestOwedBefore = cl.interestOwed();
    uint256 balanceBefore = cl.balance();

    fundAddress(address(this), totalIntOwed + principalAmount);
    usdc.approve(address(callableLoan), totalIntOwed + principalAmount);
    ILoan.PaymentAllocation memory pa = callableLoan.pay(principalAmount + totalIntOwed);

    assertEq(cl.interestAccrued(), interestAccruedBefore - pa.accruedInterestPayment);
    assertEq(cl.interestOwed(), interestOwedBefore - pa.owedInterestPayment);
    assertEq(cl.balance(), balanceBefore - (pa.principalPayment + pa.additionalBalancePayment));
  }
}

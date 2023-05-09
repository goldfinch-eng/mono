// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanPayAllocationTest is CallableLoanBaseTest {
  using SaturatingSub for uint256;

  function testOnlyTakesWhatsNeededForExcessInterestAndPrincipalPayment(
    uint256 principalAmount,
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    warpToAfterDrawdownPeriod(callableLoan);
    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 latestPayableInterestDueDate = Math.max(
      block.timestamp,
      callableLoan.nextPrincipalDueTime()
    );

    uint256 totalIntPayable = maxPayableInterest(callableLoan);

    interestAmount = bound(interestAmount, totalIntPayable, totalIntPayable * 10);

    uint256 totalPrincipalOwed = cl.balance();
    principalAmount = bound(principalAmount, totalPrincipalOwed, totalPrincipalOwed * 10);

    uint256 totalAmountPayable = totalIntPayable + totalPrincipalOwed;
    uint256 paymentAmount = principalAmount + interestAmount;
    fundAddress(address(this), paymentAmount);
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.approve(address(callableLoan), paymentAmount);
    callableLoan.pay(paymentAmount);

    // Balance should only decrease by total  owed even if that is less than the amount paid
    assertEq(usdc.balanceOf(address(this)), balanceBefore - totalAmountPayable);
  }

  function testAcceptsPaymentUpToTotalInterestOwed(
    uint256 interestAmount,
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(400));
    warpToAfterDrawdownPeriod(callableLoan);

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
    warpToAfterDrawdownPeriod(callableLoan);

    timestamp = bound(timestamp, block.timestamp + 1 days, cl.termEndTime());
    vm.warp(timestamp);

    uint256 latestPayableInterestDueDate = Math.max(
      block.timestamp,
      callableLoan.nextPrincipalDueTime()
    );

    uint256 totalIntPayable = cl.interestOwedAt(latestPayableInterestDueDate) +
      cl.interestAccruedAt(latestPayableInterestDueDate);
    principalAmount = bound(principalAmount, 0, cl.balance());

    uint256 interestAccruedBefore = cl.interestAccrued();
    uint256 interestOwedBefore = cl.interestOwed();
    uint256 balanceBefore = cl.balance();

    fundAddress(address(this), totalIntPayable + principalAmount);
    usdc.approve(address(callableLoan), totalIntPayable + principalAmount);
    ILoan.PaymentAllocation memory pa = callableLoan.pay(principalAmount + totalIntPayable);

    assertEq(cl.interestAccrued(), interestAccruedBefore.saturatingSub(pa.accruedInterestPayment));
    assertEq(cl.interestOwed(), interestOwedBefore - pa.owedInterestPayment);
    assertEq(cl.balance(), balanceBefore - (pa.principalPayment + pa.additionalBalancePayment));
  }
}

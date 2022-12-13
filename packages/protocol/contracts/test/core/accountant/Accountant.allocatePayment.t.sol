// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Accountant} from "../../../protocol/core/Accountant.sol";

import {AccountantBaseTest} from "./BaseAccountant.t.sol";

contract AccountantAllocatePaymentTest is AccountantBaseTest {
  /*
  When the interestOwed exceeds paymentAmount then the entire payment amount should go to interestOwed
  */
  function testAllocatePaymentUpToInterestOwed(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) public {
    paymentAmount = bound(paymentAmount, 0, interestOwed);
    Accountant.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      balance,
      interestOwed,
      principalOwed
    );
    assertEq(pa.interestPayment, paymentAmount, "Entire payment should go to interest");
    assertEq(pa.principalPayment, 0, "None of the payment should go to principal");
    assertEq(pa.additionalBalancePayment, 0, "None of the payment should go to balance");
  }

  /*
  When the payment amount is between [interestOwed, interestOwed + principalOwed] then all
  interest owed should be payed and whatever is left should go to principalOwed
  */
  function testAllocatePaymentUpToPrincipalOwed(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) public {
    // Make sure the sum of the debts doesn't exceed the max int
    interestOwed = bound(interestOwed, 0, type(uint256).max / 2);
    principalOwed = bound(principalOwed, 0, type(uint256).max / 2);
    paymentAmount = bound(paymentAmount, interestOwed, interestOwed + principalOwed);
    vm.assume(balance >= principalOwed);

    Accountant.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      balance,
      interestOwed,
      principalOwed
    );
    assertEq(pa.interestPayment, interestOwed, "Repaid full interest owed");
    assertEq(pa.principalPayment, paymentAmount - interestOwed, "Repaid remaining after interest");
    assertEq(pa.additionalBalancePayment, 0, "None of the payment should go to balance");
  }

  /*
  When paymentAmount exceeds interestOwed + principalOwed then interestOwed and principalOwed should be
  fully paid, and if if there is any remaining balance is should be reduced by the leftover payment amount
  */
  function testAllocatePaymentUpToBalance(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) public {
    // Make sure the sum of the debts doesn't exceed the max int
    interestOwed = bound(interestOwed, 0, type(uint256).max / 3);
    principalOwed = bound(principalOwed, 0, type(uint256).max / 3);
    balance = bound(balance, 0, type(uint256).max / 3);
    paymentAmount = bound(paymentAmount, interestOwed + principalOwed, type(uint256).max);
    vm.assume(balance >= principalOwed);

    Accountant.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      balance,
      interestOwed,
      principalOwed
    );

    assertEq(pa.interestPayment, interestOwed, "Repaid full interest owed");
    assertEq(pa.principalPayment, principalOwed, "Repaid full principal owed");
    uint256 remainingBalance = balance - principalOwed;
    uint256 remainingPayment = paymentAmount - interestOwed - principalOwed;
    uint256 expectedAdditionalBalancePayment = remainingBalance < remainingPayment
      ? remainingBalance
      : remainingPayment;
    assertEq(
      pa.additionalBalancePayment,
      expectedAdditionalBalancePayment,
      "Repaid additional balance"
    );
  }
}

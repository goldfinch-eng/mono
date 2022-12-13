// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Accountant} from "../../../protocol/core/Accountant.sol";

import {AccountantBaseTest} from "./BaseAccountant.t.sol";

contract AccountantAllocatePrincipalPaymentTest is AccountantBaseTest {
  function testAllocatePaymentUpToPrincipalOwed(
    uint256 paymentAmount,
    uint256 balance,
    uint256 principalOwed
  ) public {
    principalOwed = bound(principalOwed, 0, balance);
    paymentAmount = bound(paymentAmount, 0, principalOwed);

    Accountant.PrincipalPaymentAllocation memory ppa = Accountant.allocatePrincipalPayment(
      paymentAmount,
      balance,
      principalOwed
    );

    assertEq(ppa.principalPayment, paymentAmount, "100% payment goes to principalOwed");
    assertEq(ppa.additionalBalancePayment, 0, "No balance payment");
    assertEq(ppa.paymentRemaining, 0, "No excess payment");
  }

  function testAllocatePaymentUpToBalance(
    uint256 paymentAmount,
    uint256 balance,
    uint256 principalOwed
  ) public {
    principalOwed = bound(principalOwed, 0, balance);
    paymentAmount = bound(paymentAmount, principalOwed, balance);

    Accountant.PrincipalPaymentAllocation memory ppa = Accountant.allocatePrincipalPayment(
      paymentAmount,
      balance,
      principalOwed
    );

    assertEq(ppa.principalPayment, principalOwed, "Full principalOwed payment");
    assertEq(
      ppa.additionalBalancePayment,
      paymentAmount - principalOwed,
      "Partial balance payment"
    );
    assertEq(ppa.paymentRemaining, 0, "No excess payment");
  }

  function testAllocatePaymentExcessPayment(
    uint256 paymentAmount,
    uint256 balance,
    uint256 principalOwed
  ) public {
    principalOwed = bound(principalOwed, 0, balance);
    vm.assume(paymentAmount > balance);

    Accountant.PrincipalPaymentAllocation memory ppa = Accountant.allocatePrincipalPayment(
      paymentAmount,
      balance,
      principalOwed
    );

    assertEq(ppa.principalPayment, principalOwed, "Full principalOwed payment");
    assertEq(
      ppa.additionalBalancePayment,
      balance - principalOwed,
      "Full additionalBalance payment"
    );
    assertEq(ppa.paymentRemaining, paymentAmount - balance, "Excess payment");
  }
}

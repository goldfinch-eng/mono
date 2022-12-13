// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Accountant} from "../../../protocol/core/Accountant.sol";

import {AccountantBaseTest} from "./BaseAccountant.t.sol";

contract AccountantAllocateInterestPaymentTest is AccountantBaseTest {
  function testAllocatePaymentUpToObligatedInterest(
    uint256 paymentAmount,
    uint256 owedInterest,
    uint256 accruedInterest
  ) public {
    paymentAmount = bound(paymentAmount, 0, owedInterest);

    Accountant.InterestPaymentAllocation memory ipa = Accountant.allocateInterestPayment(
      paymentAmount,
      owedInterest,
      accruedInterest
    );

    assertEq(ipa.owedInterestPayment, paymentAmount, "100% payment goes to obligated interest");
    assertEq(ipa.accruedInterestPayment, 0, "No additional interest payment");
    assertEq(ipa.paymentRemaining, 0, "No excess payment");
  }

  function testAllocatePaymentUpToAdditionalInterest(
    uint256 paymentAmount,
    uint256 owedInterest,
    uint256 accruedInterest
  ) public {
    // Bound oligated and additional interest to prevent overflow in paymentAmount
    vm.assume(owedInterest <= type(uint256).max / 2);
    vm.assume(accruedInterest <= type(uint256).max / 2);
    paymentAmount = bound(paymentAmount, owedInterest, owedInterest + accruedInterest);

    Accountant.InterestPaymentAllocation memory ipa = Accountant.allocateInterestPayment(
      paymentAmount,
      owedInterest,
      accruedInterest
    );

    assertEq(ipa.owedInterestPayment, owedInterest, "Full oblitated interest payment");
    assertEq(
      ipa.accruedInterestPayment,
      paymentAmount - owedInterest,
      "Partial additional interest payment"
    );
    assertEq(ipa.paymentRemaining, 0, "No excess payment");
  }

  function testAllocateExcessPayment(
    uint256 paymentAmount,
    uint256 owedInterest,
    uint256 accruedInterest
  ) public {
    // Bound oligated and additional interest to prevent overflow in paymentAmount
    vm.assume(owedInterest <= type(uint256).max / 2);
    vm.assume(accruedInterest <= type(uint256).max / 2);
    paymentAmount = bound(paymentAmount, owedInterest + accruedInterest, type(uint256).max);

    Accountant.InterestPaymentAllocation memory ipa = Accountant.allocateInterestPayment(
      paymentAmount,
      owedInterest,
      accruedInterest
    );

    assertEq(ipa.owedInterestPayment, owedInterest, "Full obligated interest payment");
    assertEq(ipa.accruedInterestPayment, accruedInterest, "Full additional interest payment");
    assertEq(
      ipa.paymentRemaining,
      paymentAmount - owedInterest - accruedInterest,
      "Excess payment"
    );
  }
}

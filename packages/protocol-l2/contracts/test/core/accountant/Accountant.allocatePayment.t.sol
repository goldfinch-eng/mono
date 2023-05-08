// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;
pragma experimental ABIEncoderV2;

import {InvariantTest} from "forge-std/InvariantTest.sol";
import {Test, console} from "forge-std/Test.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";

contract AccountantAllocatePaymentTest is Test, InvariantTest {
  AccountantHandler public accountantHandler = new AccountantHandler();

  function setUp() public {
    targetContract(address(accountantHandler));
    targetSender(address(0xDEADBEEF));
  }

  function testRegression() public {
    /*
    This scenario should trigger an "AI" revert because
      interestAccrued > interestAccrued payment
      remainingPrincipalPayment > 0
      balance - owedPrincipalPayment > 0.
    But there was a bug in the "AI" revert condition where the owedInterestPayment was
    subtracted from the balance instead of the owedPrincipalPayment:
      if (
        accruedInterestPayment < params.interestAccrued &&
        remainingPrincipalPayment > 0 &&
        params.balance.sub(owedInterestPayment) > 0
      ) {
        revert("AI");
      }
    This test catches that bug. The buggy code WILL NOT revert for the given inputs
     */
    vm.expectRevert(bytes("AI"));
    Accountant.allocatePayment(
      Accountant.AllocatePaymentParams({
        principalPayment: 6,
        interestPayment: 15,
        balance: 10,
        interestOwed: 10,
        interestAccrued: 6,
        principalOwed: 5
      })
    );
  }

  // TODO: reversion tests

  function invariant_owedInterestIsPaidFirst() public {
    accountantHandler.assertInvariantOwedInterestIsPaidFirst();
  }

  function invariant_assertOwedPrincipalIsPaidSecond() public {
    accountantHandler.assertOwedPrincipalIsPaidSecond();
  }

  function invariant_assertAccruedInterestIsPaidThird() public {
    accountantHandler.assertAccruedInterestIsPaidThird();
  }
}

contract AccountantHandler is Test {
  uint internal constant MIN_BALANCE = 1_000e6;
  uint internal constant MAX_BALANCE = 100_000_000e6;
  uint internal constant MAX_INTEREST_OWED = 100_000_000e6;

  uint public interestOwed;
  uint public principalOwed;
  uint public accruedInterest;
  ITranchedPool.PaymentAllocation public pa;

  function splitPayment(
    uint256 _paymentAmount,
    uint256 _balance,
    uint256 _interestOwed,
    uint256 _interestAccrued,
    uint256 _principalOwed
  ) public {
    vm.assume(_paymentAmount > 0);
    vm.assume(_balance >= MIN_BALANCE && _balance <= MAX_BALANCE);
    vm.assume(_principalOwed <= _balance);
    interestOwed = _interestOwed;
    principalOwed = _principalOwed;
    accruedInterest = _interestAccrued;
    (uint interestPayment, uint principalPayment) = Accountant.splitPayment({
      paymentAmount: _paymentAmount,
      balance: _balance,
      interestOwed: _interestOwed,
      interestAccrued: _interestAccrued,
      principalOwed: _principalOwed
    });

    pa = Accountant.allocatePayment(
      Accountant.AllocatePaymentParams({
        principalPayment: principalPayment,
        interestPayment: interestPayment,
        balance: _balance,
        interestOwed: _interestOwed,
        interestAccrued: _interestAccrued,
        principalOwed: _principalOwed
      })
    );
    _displayPaymentAllocation();
  }

  function allocatePayment(
    uint256 _principalPayment,
    uint256 _interestPayment,
    uint256 _balance,
    uint256 _interestOwed,
    uint256 _interestAccrued,
    uint256 _principalOwed
  ) public virtual {
    vm.assume(_principalPayment > 0 || _interestPayment > 0);
    vm.assume(_balance >= MIN_BALANCE && _balance <= MAX_BALANCE);
    vm.assume(_principalOwed <= _balance);
    interestOwed = _interestOwed;
    principalOwed = _principalOwed;
    accruedInterest = _interestAccrued;
    pa = Accountant.allocatePayment(
      Accountant.AllocatePaymentParams({
        principalPayment: _principalPayment,
        interestPayment: _interestPayment,
        balance: _balance,
        interestOwed: _interestOwed,
        interestAccrued: _interestAccrued,
        principalOwed: _principalOwed
      })
    );

    _displayPaymentAllocation();
  }

  function _displayPaymentAllocation() internal {
    console.log("OI", pa.owedInterestPayment);
    console.log("I", interestOwed);
    console.log("PO", principalOwed);
    console.log("P", pa.principalPayment);
    console.log("A", accruedInterest);
    console.log("AI", pa.accruedInterestPayment);
    console.log("B", pa.additionalBalancePayment);
    console.log("R", pa.paymentRemaining);
  }

  // when interest is owed, it has to be paid before anything else
  // if interestOwed > 0 -> interestPayment <
  function assertInvariantOwedInterestIsPaidFirst() public {
    bool noInterestOwed = interestOwed == 0;
    bool onlyInterestPaid = interestOwed > 0 &&
      pa.owedInterestPayment < interestOwed &&
      pa.principalPayment == 0 &&
      pa.accruedInterestPayment == 0 &&
      pa.additionalBalancePayment == 0;
    bool interestPaidOffCompletelyBeforeAnythingElse = interestOwed > 0 &&
      pa.owedInterestPayment == interestOwed;
    assertTrue(
      noInterestOwed || onlyInterestPaid || interestPaidOffCompletelyBeforeAnythingElse,
      "XXX"
    );
  }

  function assertOwedPrincipalIsPaidSecond() public {
    bool noPrincipalOwed = principalOwed == 0;
    bool principalIsPartiallyRepaidButNothingAfterIsPaid = pa.principalPayment < principalOwed &&
      pa.additionalBalancePayment == 0 &&
      pa.accruedInterestPayment == 0;
    bool principalIsPaidOff = pa.principalPayment == principalOwed;

    assertTrue(
      noPrincipalOwed || principalIsPartiallyRepaidButNothingAfterIsPaid || principalIsPaidOff,
      "no interest or principal owed"
    );
  }

  function assertAccruedInterestIsPaidThird() public {
    bool noAccruedInterest = accruedInterest == 0;
    bool accuredInterestPartiallyRepaid = accruedInterest > 0 &&
      pa.accruedInterestPayment < accruedInterest &&
      pa.additionalBalancePayment == 0;
    bool accuredInterestRepaid = accruedInterest == pa.accruedInterestPayment;
    assertTrue(noAccruedInterest || accuredInterestPartiallyRepaid || accuredInterestRepaid);
  }
}

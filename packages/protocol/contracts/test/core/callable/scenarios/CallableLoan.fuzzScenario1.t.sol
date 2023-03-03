pragma solidity ^0.8.0;

import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {ICallableLoan} from "../../../../interfaces/ICallableLoan.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {SaturatingSub} from "../../../../library/SaturatingSub.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract CallableLoanScenario1Test is CallableLoanBaseTest {
  using SaturatingSub for uint256;

  CallableLoan callableLoan;
  // Use storage array to get around Solidity stack size limits.
  uint user1PoolTokenId;
  uint user2PoolTokenId;
  uint user3PoolTokenId;

  uint user1PoolTokenIdCalledSplit;
  uint user1PoolTokenIdUncalledSplit;
  uint user2PoolTokenIdCalledSplit;
  uint user2PoolTokenIdUncalledSplit;
  uint totalDeposits;

  uint firstInterestAccrued;
  uint firstInterestOwedAtNextDueTime;
  uint firstInterestOwedAtNextPrincipalDueTime;
  uint originalBalance;
  uint loanContractBalanceBefore;
  uint userBalanceBefore;
  uint totalInterestPayment;
  uint totalPrincipalPayment;

  uint user1PoolTokenAvailableToCall;
  uint user2PoolTokenAvailableToCall;
  uint user3PoolTokenAvailableToCall;
  uint user1PoolTokenUncalledSplitAvailableToCall;

  uint user1TokenPrincipalAvailableForWithdraw;
  uint user2TokenInterestAvailableForWithdraw;
  uint user2TokenPrincipalAvailableForWithdraw;
  uint user3TokenInterestAvailableForWithdraw;
  uint user3TokenPrincipalAvailableForWithdraw;
  uint user1PoolTokenUncalledSplitInterestAvailableForWithdraw;
  uint user1PoolTokenCalledSplitInterestAvailableForWithdraw;
  uint user1PoolTokenUncalledSplitPrincipalAvailableForWithdraw;
  uint user1PoolTokenCalledSplitPrincipalAvailableForWithdraw;
  // Use storage buffer to get around Solidity stack size limits.
  uint interestAvailableToWithdraw;
  uint principalAvailableToWithdraw;

  ILoan.PaymentAllocation paymentAllocation;
  ICallableLoan.UncalledCapitalInfo uncalledCapitalInfo;
  ICallableLoan.CallRequestPeriod callRequestPeriod;

  function testCallableScenario1(
    uint256 depositAmount1,
    uint256 depositAmount2,
    uint256 depositAmount3,
    uint256 callAmount1,
    uint256 callAmount2,
    address user1,
    address user2,
    address user3,
    uint256 drawdownAmount,
    uint256 paymentAmount
  ) public {
    depositAmount1 = bound(depositAmount1, 1, usdcVal(100_000_000));
    depositAmount2 = bound(depositAmount2, 1, usdcVal(100_000_000));
    depositAmount3 = bound(depositAmount3, 1, usdcVal(100_000_000));
    totalDeposits = depositAmount1 + depositAmount2 + depositAmount3;

    drawdownAmount = bound(drawdownAmount, 1, totalDeposits);
    (CallableLoan callableLoan, ) = callableLoanWithLimit(totalDeposits);

    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    vm.assume(fuzzHelper.isAllowed(user3));

    uid._mintForTest(user1, 1, 1, "");
    uid._mintForTest(user2, 1, 1, "");
    uid._mintForTest(user3, 1, 1, "");

    user1PoolTokenId = deposit(callableLoan, depositAmount1, user1);
    user2PoolTokenId = deposit(callableLoan, depositAmount2, user2);
    user3PoolTokenId = deposit(callableLoan, depositAmount3, user3);

    drawdown(callableLoan, drawdownAmount);

    console.log("totalDeposits", totalDeposits);
    uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
    assertEq(uncalledCapitalInfo.principalDeposited, totalDeposits, "Total principal deposits");
    assertEq(
      uncalledCapitalInfo.principalPaid,
      totalDeposits - drawdownAmount,
      "Total principal paid"
    );

    warpToAfterDrawdownPeriod(callableLoan);

    console.log("Before 1st call submission frame");
    /// Call Submission 1 - After Drawdown Period
    /// Assert call submission updates accounting correctly.
    /// Use {} to produce new stack frame and avoid stack too deep errors.
    {
      assertEq(
        callableLoan.totalPrincipalOwedAt(callableLoan.nextPrincipalDueTime()),
        0,
        "Original principal owed"
      );
      assertEq(
        callableLoan.totalPrincipalPaid(),
        (totalDeposits) - drawdownAmount,
        "Original principal paid"
      );
      originalBalance = callableLoan.balance();
      assertEq(originalBalance, drawdownAmount, "Original balance");
      firstInterestOwedAtNextDueTime = callableLoan.interestOwedAt(callableLoan.nextDueTime());
      firstInterestOwedAtNextPrincipalDueTime = callableLoan.interestOwedAt(
        callableLoan.nextPrincipalDueTime()
      );
      firstInterestAccrued = callableLoan.interestAccrued();

      user1PoolTokenAvailableToCall = callableLoan.availableToCall(user1PoolTokenId);
      user2PoolTokenAvailableToCall = callableLoan.availableToCall(user2PoolTokenId);
      user3PoolTokenAvailableToCall = callableLoan.availableToCall(user3PoolTokenId);

      (
        user2TokenInterestAvailableForWithdraw,
        user2TokenPrincipalAvailableForWithdraw
      ) = callableLoan.availableToWithdraw(user2PoolTokenId);
      (
        user3TokenInterestAvailableForWithdraw,
        user3TokenPrincipalAvailableForWithdraw
      ) = callableLoan.availableToWithdraw(user3PoolTokenId);
      assertApproxEqAbs(
        user1PoolTokenAvailableToCall,
        (depositAmount1 * drawdownAmount) / totalDeposits,
        HUNDREDTH_CENT,
        "Max available to call 1"
      );
      callAmount1 = bound(callAmount1, 0, user1PoolTokenAvailableToCall);
      if (callAmount1 > 0) {
        (user1PoolTokenIdCalledSplit, user1PoolTokenIdUncalledSplit) = submitCall(
          callableLoan,
          callAmount1,
          user1PoolTokenId,
          user1
        );
        console.log("Submitted call 1!");
      }

      assertApproxEqAbs(
        callableLoan.availableToCall(user2PoolTokenId),
        user2PoolTokenAvailableToCall,
        HUNDREDTH_CENT,
        "Submitting a call should not affect how much others are owed - Principal outstanding 2"
      );
      assertApproxEqAbs(
        callableLoan.availableToCall(user3PoolTokenId),
        user3PoolTokenAvailableToCall,
        HUNDREDTH_CENT,
        "Submitting a call should not affect how much others are owed - Principal outstanding 3"
      );

      (interestAvailableToWithdraw, principalAvailableToWithdraw) = callableLoan
        .availableToWithdraw(user2PoolTokenId);
      assertApproxEqAbs(
        interestAvailableToWithdraw,
        user2TokenInterestAvailableForWithdraw,
        HUNDREDTH_CENT,
        "Submitting a call should not affect how much others are owed - Interest 2"
      );
      (interestAvailableToWithdraw, principalAvailableToWithdraw) = callableLoan
        .availableToWithdraw(user3PoolTokenId);
      assertApproxEqAbs(
        interestAvailableToWithdraw,
        user3TokenInterestAvailableForWithdraw,
        HUNDREDTH_CENT,
        "Submitting a call should not affect how much others are owed - Interest 3"
      );

      assertApproxEqAbs(
        callableLoan.principalOwedAt(callableLoan.nextPrincipalDueTime()),
        callAmount1,
        HUNDREDTH_CENT,
        "New principal owed"
      );
      assertEq(
        callableLoan.totalPrincipalPaid(),
        totalDeposits - drawdownAmount,
        "New principal paid"
      );
      assertApproxEqAbs(callableLoan.balance(), drawdownAmount, HUNDREDTH_CENT, "New balance");
      assertApproxEqAbs(
        callableLoan.interestOwedAt(callableLoan.nextDueTime()),
        firstInterestOwedAtNextDueTime,
        HUNDREDTH_CENT,
        "Interest owed at next due time"
      );
      assertApproxEqAbs(
        callableLoan.interestOwedAt(callableLoan.nextPrincipalDueTime()),
        firstInterestOwedAtNextPrincipalDueTime,
        HUNDREDTH_CENT,
        "Interest owed at next principal due time"
      );
      assertEq(callableLoan.interestAccrued(), firstInterestAccrued, "Interest accrued");

      callRequestPeriod = callableLoan.getCallRequestPeriod(0);

      assertEq(
        callRequestPeriod.principalDeposited - callRequestPeriod.principalPaid,
        callAmount1,
        "callRequestPeriod principal outstanding"
      );
      assertEq(callRequestPeriod.principalReserved, 0, "callRequestPeriod principal Reserved");
      assertEq(callRequestPeriod.interestPaid, 0, "callRequestPeriod interest paid");

      uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
      // TODO: uncalledCapitalInfo Assertions
    }

    /// Pay - After First Call Submission
    /// Assert payment updates accounting correctly.
    /// Use {} to produce new stack frame and avoid stack too deep errors.
    console.log("Before pay frame");
    {
      paymentAmount = bound(paymentAmount, 1, usdcVal(100_000_000_000));
      fundAddress(address(this), paymentAmount);
      usdc.approve(address(callableLoan), paymentAmount);
      loanContractBalanceBefore = usdc.balanceOf(address(callableLoan));
      userBalanceBefore = usdc.balanceOf(address(this));

      paymentAllocation = callableLoan.pay(paymentAmount);
      assertEq(paymentAllocation.principalPayment, 0, "principal 0");
      assertApproxEqAbs(
        callableLoan.interestAccrued(),
        firstInterestAccrued.saturatingSub(paymentAllocation.accruedInterestPayment),
        HUNDREDTH_CENT,
        "accrued"
      );

      assertEq(paymentAllocation.owedInterestPayment, 0, "paid 0");
      assertEq(callableLoan.interestOwed(), 0, "owes 0");

      assertEq(
        callableLoan.balance(),
        originalBalance.saturatingSub(paymentAllocation.additionalBalancePayment),
        "balance"
      );

      totalInterestPayment =
        paymentAllocation.accruedInterestPayment +
        paymentAllocation.owedInterestPayment;
      totalPrincipalPayment =
        paymentAllocation.principalPayment +
        paymentAllocation.additionalBalancePayment;
      assertApproxEqAbs(
        usdc.balanceOf(address(callableLoan)),
        loanContractBalanceBefore + totalPrincipalPayment + ((totalInterestPayment * 90) / 100),
        HUNDREDTH_CENT,
        "loan contract balance"
      );
      callRequestPeriod = callableLoan.getCallRequestPeriod(0);

      assertEq(
        callRequestPeriod.principalDeposited - callRequestPeriod.principalPaid,
        callAmount1,
        "callRequestPeriod principal outstanding"
      );
      assertEq(
        callRequestPeriod.principalReserved,
        Math.min(callAmount1, paymentAllocation.additionalBalancePayment),
        "callRequestPeriod principal Reserved"
      );
      assertEq(
        callRequestPeriod.interestPaid,
        (paymentAllocation.accruedInterestPayment *
          (callRequestPeriod.principalDeposited - callRequestPeriod.principalPaid)) /
          (callableLoan.interestBearingBalance()),
        "callRequestPeriod interest paid"
      );

      uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
      // TODO: uncalledCapitalInfo Assertions
    }

    /// Submit Call request 2 from user 2
    /// Check that we update accounting correctly.
    /// Use {} to produce new stack frame and avoid stack too deep errors.
    console.log("Before 2nd call submission frame");
    {
      uint interestOwedAtNextDueTime = callableLoan.interestOwedAt(callableLoan.nextDueTime());
      uint interestOwedAtNextPrincipalDueTime = callableLoan.interestOwedAt(
        callableLoan.nextPrincipalDueTime()
      );

      uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();

      if (user1PoolTokenIdUncalledSplit > 0) {
        user1PoolTokenUncalledSplitAvailableToCall = callableLoan.availableToCall(
          user1PoolTokenIdUncalledSplit
        );
        (
          user1PoolTokenUncalledSplitInterestAvailableForWithdraw,
          user1PoolTokenUncalledSplitPrincipalAvailableForWithdraw
        ) = callableLoan.availableToWithdraw(user1PoolTokenIdUncalledSplit);
      }

      if (user1PoolTokenIdCalledSplit > 0) {
        (
          user1PoolTokenCalledSplitInterestAvailableForWithdraw,
          user1PoolTokenCalledSplitPrincipalAvailableForWithdraw
        ) = callableLoan.availableToWithdraw(user1PoolTokenIdCalledSplit);
      }
      user2PoolTokenAvailableToCall = callableLoan.availableToCall(user2PoolTokenId);
      user3PoolTokenAvailableToCall = callableLoan.availableToCall(user3PoolTokenId);

      (
        user3TokenInterestAvailableForWithdraw,
        user3TokenPrincipalAvailableForWithdraw
      ) = callableLoan.availableToWithdraw(user3PoolTokenId);

      assertApproxEqAbs(
        user2PoolTokenAvailableToCall,
        (depositAmount2 *
          (uncalledCapitalInfo.principalDeposited - uncalledCapitalInfo.principalPaid)) /
          uncalledCapitalInfo.principalDeposited,
        HUNDREDTH_CENT,
        "Max available to call 2"
      );
      callAmount2 = bound(callAmount2, 0, user2PoolTokenAvailableToCall);

      if (callAmount2 > 0) {
        console.log("About to call, here are accounting variables");
        callRequestPeriod = callableLoan.getCallRequestPeriod(0);
        console.log("callRequestPeriod.principalDeposited:", callRequestPeriod.principalDeposited);
        console.log("callRequestPeriod.principalPaid:", callRequestPeriod.principalPaid);

        uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
        console.log(
          "uncalledCapitalInfo.principalDeposited:",
          uncalledCapitalInfo.principalDeposited
        );
        console.log("uncalledCapitalInfo.principalPaid:", uncalledCapitalInfo.principalPaid);
        (user2PoolTokenIdCalledSplit, user2PoolTokenIdUncalledSplit) = submitCall(
          callableLoan,
          callAmount2,
          user2PoolTokenId,
          user2
        );

        console.log("Submitted call 2!");
        console.log("user2PoolTokenIdCalledSplit", user2PoolTokenIdCalledSplit);
        console.log("user2PoolTokenIdCalledSplit", user2PoolTokenIdUncalledSplit);
        callRequestPeriod = callableLoan.getCallRequestPeriod(0);
        console.log("callRequestPeriod.principalDeposited:", callRequestPeriod.principalDeposited);
        console.log("callRequestPeriod.principalPaid:", callRequestPeriod.principalPaid);
      }

      console.log("user1PoolTokenIdUncalledSplit", user1PoolTokenIdUncalledSplit);
      if (user1PoolTokenIdUncalledSplit > 0) {
        assertApproxEqAbs(
          callableLoan.availableToCall(user1PoolTokenIdUncalledSplit),
          user1PoolTokenUncalledSplitAvailableToCall,
          HALF_CENT,
          "Submitting a call should not affect how much others are owed - Principal outstanding 1"
        );
        (interestAvailableToWithdraw, principalAvailableToWithdraw) = callableLoan
          .availableToWithdraw(user1PoolTokenIdUncalledSplit);
        assertApproxEqAbs(
          interestAvailableToWithdraw,
          user1PoolTokenUncalledSplitInterestAvailableForWithdraw,
          HUNDREDTH_CENT,
          "Submitting a call should not affect how much others are owed - Interest 1"
        );
      }
      if (user1PoolTokenIdCalledSplit > 0) {
        (interestAvailableToWithdraw, principalAvailableToWithdraw) = callableLoan
          .availableToWithdraw(user1PoolTokenIdCalledSplit);
        assertApproxEqAbs(
          interestAvailableToWithdraw,
          user1PoolTokenCalledSplitInterestAvailableForWithdraw,
          HUNDREDTH_CENT,
          "Submitting a call should not affect how much others are owed - Interest 1"
        );
      }
      assertApproxEqAbs(
        callableLoan.availableToCall(user3PoolTokenId),
        user3PoolTokenAvailableToCall,
        HUNDREDTH_CENT,
        "Submitting a call should not affect how much others are owed - Principal outstanding 3"
      );

      (interestAvailableToWithdraw, principalAvailableToWithdraw) = callableLoan
        .availableToWithdraw(user3PoolTokenId);
      assertApproxEqAbs(
        interestAvailableToWithdraw,
        user3TokenInterestAvailableForWithdraw,
        HALF_CENT,
        "Submitting a call should not affect how much others are owed - Interest 3"
      );

      assertApproxEqAbs(
        callableLoan.principalOwedAt(callableLoan.nextPrincipalDueTime()),
        (callAmount1 + callAmount2).saturatingSub(paymentAllocation.additionalBalancePayment),
        HUNDREDTH_CENT,
        "New principal owed"
      );

      assertEq(
        callableLoan.totalPrincipalPaid(),
        totalDeposits - drawdownAmount,
        "New principal paid"
      );
      assertApproxEqAbs(
        callableLoan.interestOwedAt(callableLoan.nextDueTime()),
        interestOwedAtNextDueTime,
        HUNDREDTH_CENT,
        "Interest owed at next due time"
      );
      assertApproxEqAbs(
        callableLoan.interestOwedAt(callableLoan.nextPrincipalDueTime()),
        interestOwedAtNextPrincipalDueTime,
        HUNDREDTH_CENT,
        "Interest owed at next principal due time"
      );

      callRequestPeriod = callableLoan.getCallRequestPeriod(0);
      assertEq(
        callRequestPeriod.principalDeposited - callRequestPeriod.principalPaid,
        callAmount1 + callAmount2,
        "callRequestPeriod principal outstanding"
      );
      assertEq(
        callRequestPeriod.principalReserved,
        Math.min(callAmount1 + callAmount2, paymentAllocation.additionalBalancePayment),
        "callRequestPeriod principal Reserved"
      );
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (paymentAllocation.accruedInterestPayment *
          (callRequestPeriod.principalDeposited - callRequestPeriod.principalPaid)) /
          (callableLoan.interestBearingBalance()),
        HUNDREDTH_CENT,
        "callRequestPeriod interest paid"
      );

      uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
      // TODO: uncalledCapitalInfo Assertions
    }

    {
      // Hash and bound user3 to get pseudorandom warp destination
      // Cannot add another fuzzed variable because of stack size limits.
      uint invalidCallSubmissionTime = uint(keccak256(abi.encode(user3)));
      invalidCallSubmissionTime = bound(
        invalidCallSubmissionTime,
        callableLoan.nextDueTime() + 1,
        callableLoan.nextPrincipalDueTime() - 1
      );
      vm.warp(invalidCallSubmissionTime);
      uint callAmount3Max = (depositAmount3 *
        (drawdownAmount - paymentAllocation.additionalBalancePayment)) / totalDeposits;
      // Hash and bound call amounts 1 and 2 to get pseudorandom call amount 3.
      // Cannot add another fuzzed variable because of stack size limits.
      uint callAmount3 = bound(uint256(keccak256(abi.encode(user1, user2))), 0, callAmount3Max);

      if (callAmount3 > 0) {
        console.log("Submitting invalid call 3. Invalid since we are in a lock period.");
        vm.expectRevert(bytes("CL"));
        submitCall(callableLoan, callAmount3, user3PoolTokenId, user3);
      }
    }

    /// Warp to right principal payment period due time
    vm.warp(callableLoan.nextPrincipalDueTime());

    /// Warp to first principal payment period due time
    /// Check that we update accounting correctly.
    /// Use {} to produce new stack frame and avoid stack too deep errors.
    console.log("After principal payment period due time frame");
    {
      uint interestOwedAtNextDueTime = callableLoan.interestOwedAt(callableLoan.nextDueTime());
      uint interestOwedAtNextPrincipalDueTime = callableLoan.interestOwedAt(
        callableLoan.nextPrincipalDueTime()
      );

      assertApproxEqAbs(
        callableLoan.principalOwed(),
        (callAmount1 + callAmount2).saturatingSub(paymentAllocation.additionalBalancePayment),
        HUNDREDTH_CENT,
        "Principal owed remains the same as previous principalOwedAt(nextPrincipalDueTime)"
      );

      assertApproxEqAbs(
        callableLoan.principalOwedAt(callableLoan.nextPrincipalDueTime()),
        (callAmount1 + callAmount2).saturatingSub(paymentAllocation.additionalBalancePayment),
        HUNDREDTH_CENT,
        "Principal owed at next principal due time remains the same as previous principalOwedAt(nextPrincipalDueTime)"
      );

      assertEq(
        callableLoan.totalPrincipalPaid(),
        totalDeposits - drawdownAmount + paymentAllocation.additionalBalancePayment,
        "New principal paid"
      );

      callRequestPeriod = callableLoan.getCallRequestPeriod(0);
      // TODO: callRequestPeriod Assertions

      uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
      // TODO: uncalledCapitalInfo Assertions
    }
  }
}

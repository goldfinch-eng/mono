pragma solidity ^0.8.0;

import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

import {CallableLoan} from "../../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../../interfaces/ICreditLine.sol";
import {ICallableLoan} from "../../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../../interfaces/ICallableLoanErrors.sol";
import {CallableLoanBaseTest} from "../BaseCallableLoan.t.sol";
import {SaturatingSub} from "../../../../library/SaturatingSub.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract CallableLoanScenario1Test is CallableLoanBaseTest {
  using SaturatingSub for uint256;

  CallableLoan callableLoan;
  // Use storage array to get around Solidity stack size limits.
  uint256 public user1PoolTokenId;
  uint256 public user2PoolTokenId;
  uint256 public user3PoolTokenId;

  uint256 public user1PoolTokenIdCalledSplit;
  uint256 public user1PoolTokenIdUncalledSplit;
  uint256 public user2PoolTokenIdCalledSplit;
  uint256 public user2PoolTokenIdUncalledSplit;
  uint256 public totalDeposits;

  uint256 public firstInterestAccrued;
  uint256 public firstInterestOwedAtNextDueTime;
  uint256 public firstInterestOwedAtNextPrincipalDueTime;
  uint256 public originalBalance;
  uint256 public loanContractBalanceBefore;
  uint256 public userBalanceBefore;
  uint256 public totalInterestPayment;
  uint256 public totalPrincipalPayment;

  uint256 public user1PoolTokenAvailableToCall;
  uint256 public user2PoolTokenAvailableToCall;
  uint256 public user3PoolTokenAvailableToCall;
  uint256 public user1PoolTokenUncalledSplitAvailableToCall;

  uint256 public user1TokenPrincipalAvailableForWithdraw;
  uint256 public user2TokenInterestAvailableForWithdraw;
  uint256 public user2TokenPrincipalAvailableForWithdraw;
  uint256 public user3TokenInterestAvailableForWithdraw;
  uint256 public user3TokenPrincipalAvailableForWithdraw;
  uint256 public user1PoolTokenUncalledSplitInterestAvailableForWithdraw;
  uint256 public user1PoolTokenCalledSplitInterestAvailableForWithdraw;
  uint256 public user1PoolTokenUncalledSplitPrincipalAvailableForWithdraw;
  uint256 public user1PoolTokenCalledSplitPrincipalAvailableForWithdraw;

  // Use storage to get around Solidity stack size limits.
  uint256 public interestAvailableToWithdraw;
  uint256 public principalAvailableToWithdraw;

  uint256 public totalCalled;

  ILoan.PaymentAllocation public paymentAllocation;
  ICallableLoan.UncalledCapitalInfo public uncalledCapitalInfo;
  ICallableLoan.UncalledCapitalInfo public afterPaymentUncalledCapitalInfo;
  ICallableLoan.CallRequestPeriod public callRequestPeriod;
  ICallableLoan.CallRequestPeriod public afterPaymentCallRequestPeriod;

  /// Submit 1 call after the drawdown period.
  /// Make a repayment after the first call submission.
  /// Submit a second call after the repayment.
  /// Warp to an invalid call submission time (lockup period). Assert a third call cannot be submitted.
  /// Assert correct application of payment to principal and interest after the payment due date passes.
  function testCallableScenario(
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
    /// STAGE 1 - Drawdowns and deposits
    {
      depositAmount1 = bound(depositAmount1, 1, usdcVal(100_000_000));
      depositAmount2 = bound(depositAmount2, 1, usdcVal(100_000_000));
      depositAmount3 = bound(depositAmount3, 1, usdcVal(100_000_000));
      totalDeposits = depositAmount1 + depositAmount2 + depositAmount3;

      drawdownAmount = bound(drawdownAmount, 1, totalDeposits);
      (callableLoan, ) = callableLoanWithLimit(totalDeposits);

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
      console.log("drawdownAmount", drawdownAmount);
    }

    warpToAfterDrawdownPeriod(callableLoan);

    /// STAGE 2 - Call Submission 1 - After drawdown period
    /// Assert call submission updates accounting correctly.
    {
      console.log("After drawdown period");
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

      totalCalled = callAmount1 = bound(callAmount1, 0, user1PoolTokenAvailableToCall);
      console.log("callAmount1:", callAmount1);
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
      assertZero(callRequestPeriod.principalReserved, "callRequestPeriod principal Reserved");
      assertZero(callRequestPeriod.interestPaid, "callRequestPeriod interest paid");

      uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
      assertEq(
        uncalledCapitalInfo.principalDeposited,
        totalDeposits - ((totalDeposits * callAmount1) / (drawdownAmount)),
        "\nUncalled principal deposited.\n"
        "See Tranche#take for calculation\n"
        "totalDeposits = uncalled principal deposited before call\n"
        "((totalDeposits * totalCalled) / (drawdownAmount)) = diff in principal deposited\n"
      );
      assertZero(uncalledCapitalInfo.principalReserved, "Uncalled principal reserved");
      assertZero(uncalledCapitalInfo.interestPaid, "Uncalled interest paid");
      assertEq(
        uncalledCapitalInfo.principalPaid,
        totalDeposits -
          drawdownAmount -
          (((totalDeposits * callAmount1) / drawdownAmount) - callAmount1),
        "\nUncalled principal paid.\n"
        "See Tranche#take for calculation\n"
        "principalPaidTaken = principalDepositedTaken - principalOutstandingToTake\n"
        "principalPaidTaken = ((totalDeposits * totalCalled) / drawdownAmount) - totalCalled)"
      );
    }

    /// STAGE 3 - Pay - After first call submission
    {
      paymentAmount = bound(paymentAmount, 1, usdcVal(100_000_000_000));
      fundAddress(address(this), paymentAmount);
      usdc.approve(address(callableLoan), paymentAmount);
      loanContractBalanceBefore = usdc.balanceOf(address(callableLoan));
      userBalanceBefore = usdc.balanceOf(address(this));

      paymentAllocation = callableLoan.pay(paymentAmount);

      console.log("Just paid");

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
      afterPaymentCallRequestPeriod = callRequestPeriod = callableLoan.getCallRequestPeriod(0);

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

      afterPaymentUncalledCapitalInfo = uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();

      assertEq(
        afterPaymentUncalledCapitalInfo.principalDeposited,
        totalDeposits - ((totalDeposits * callAmount1) / (drawdownAmount)),
        "\nUncalled principal deposited.\n"
        "See Tranche#take for calculation\n"
        "totalDeposits = uncalled principal deposited before call\n"
        "((totalDeposits * callAmount1) / (drawdownAmount)) = diff in principal deposited\n"
      );

      assertEq(
        afterPaymentUncalledCapitalInfo.principalReserved,
        paymentAllocation.additionalBalancePayment - callRequestPeriod.principalReserved,
        "Uncalled principal reserved"
      );
      assertApproxEqAbs(
        afterPaymentUncalledCapitalInfo.interestPaid,
        (paymentAllocation.accruedInterestPayment *
          (afterPaymentUncalledCapitalInfo.principalDeposited -
            afterPaymentUncalledCapitalInfo.principalPaid)) / callableLoan.interestBearingBalance(),
        1,
        "Uncalled interest paid"
      );
      assertEq(
        afterPaymentUncalledCapitalInfo.principalPaid,
        totalDeposits -
          drawdownAmount -
          ((totalDeposits * callAmount1) / (drawdownAmount) - callAmount1),
        "\nUncalled principal paid.\n"
        "See Tranche#take for calculation\n"
        "principalPaidTaken = principalDepositedTaken - principalOutstandingToTake\n"
        "principalPaidTaken = ((totalDeposits * callAmount1) / drawdownAmount) - callAmount1)"
      );
    }

    /// STAGE 4 - Submit call request 2 from user 2
    {
      uint256 interestOwedAtNextDueTime = callableLoan.interestOwedAt(callableLoan.nextDueTime());
      uint256 interestOwedAtNextPrincipalDueTime = callableLoan.interestOwedAt(
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
      totalCalled = callAmount1 + callAmount2;

      console.log("callAmount2:", callAmount2);
      console.log("totalCalled:", totalCalled);

      if (callAmount2 > 0) {
        (user2PoolTokenIdCalledSplit, user2PoolTokenIdUncalledSplit) = submitCall(
          callableLoan,
          callAmount2,
          user2PoolTokenId,
          user2
        );

        console.log("Submitted call 2!");
      }

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
        "Submitting a call should not affect how much others are owed - Interest"
      );

      assertApproxEqAbs(
        callableLoan.principalOwedAt(callableLoan.nextPrincipalDueTime()),
        totalCalled.saturatingSub(paymentAllocation.additionalBalancePayment),
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
        totalCalled,
        "callRequestPeriod principal outstanding"
      );
      assertEq(
        callRequestPeriod.principalReserved,
        Math.min(totalCalled, paymentAllocation.additionalBalancePayment),
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
      assertApproxEqAbs(
        uncalledCapitalInfo.principalDeposited,
        totalDeposits - ((totalDeposits * (totalCalled)) / (drawdownAmount)),
        1,
        "\nUncalled principal deposited.\n"
        "See Tranche#take for calculation\n"
        "totalDeposits = uncalled principal deposited before call\n"
        "((totalDeposits * callAmount1) / (drawdownAmount)) = diff in principal deposited\n"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalReserved,
        paymentAllocation.additionalBalancePayment - callRequestPeriod.principalReserved,
        1,
        "Uncalled principal reserved"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.interestPaid,
        (paymentAllocation.accruedInterestPayment *
          (uncalledCapitalInfo.principalDeposited - uncalledCapitalInfo.principalPaid)) /
          callableLoan.interestBearingBalance(),
        2, // Margin of error increases by 1 for every successful call (there were 2) submitted
        "Uncalled interest paid"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalPaid,
        totalDeposits -
          drawdownAmount -
          (((totalDeposits * (totalCalled)) / drawdownAmount) - (totalCalled)),
        1,
        "\nUncalled principal paid.\n"
        "See Tranche#take for calculation\n"
        "principalPaidTaken = principalDepositedTaken - principalOutstandingToTake\n"
        "principalPaidTaken = ((totalDeposits * totalCalled) / drawdownAmount) - totalCalled"
      );
    }

    /// STAGE 5 - Attempt Invalid Call request 3 from user 3
    {
      // Hash and bound user3 to get pseudorandom warp destination
      // Cannot add another fuzzed variable because of stack size limits.
      uint256 invalidCallSubmissionTime = uint256(keccak256(abi.encode(user3)));
      invalidCallSubmissionTime = bound(
        invalidCallSubmissionTime,
        callableLoan.nextDueTime() + 1,
        callableLoan.nextPrincipalDueTime() - 1
      );
      vm.warp(invalidCallSubmissionTime);
      uint256 callAmount3Max = (depositAmount3 *
        (drawdownAmount - paymentAllocation.additionalBalancePayment)) / totalDeposits;
      // Hash and bound call amounts 1 and 2 to get pseudorandom call amount 3.
      // Cannot add another fuzzed variable because of stack size limits.
      uint256 callAmount3 = bound(uint256(keccak256(abi.encode(user1, user2))), 0, callAmount3Max);

      if (callAmount3 > 0) {
        console.log("Submitting invalid call 3. Invalid since we are in a lock period.");
        vm.expectRevert(ICallableLoanErrors.CannotSubmitCallInLockupPeriod.selector);
        submitCall(callableLoan, callAmount3, user3PoolTokenId, user3);
      }
    }

    /// STAGE 6 - Warped to first principal payment period due time
    /// Check that we update accounting correctly.
    {
      vm.warp(callableLoan.nextPrincipalDueTime());
      console.log("Warped to next principal due time");

      uint256 interestOwedAtNextDueTime = callableLoan.interestOwedAt(callableLoan.nextDueTime());
      uint256 interestOwedAtNextPrincipalDueTime = callableLoan.interestOwedAt(
        callableLoan.nextPrincipalDueTime()
      );

      assertApproxEqAbs(
        callableLoan.principalOwed(),
        (totalCalled).saturatingSub(paymentAllocation.additionalBalancePayment),
        HUNDREDTH_CENT,
        "Principal owed remains the same as previous principalOwedAt(nextPrincipalDueTime)"
      );

      assertApproxEqAbs(
        callableLoan.principalOwedAt(callableLoan.nextPrincipalDueTime()),
        (totalCalled).saturatingSub(paymentAllocation.additionalBalancePayment),
        HUNDREDTH_CENT,
        "Principal owed at next principal due time remains the same as previous principalOwedAt(nextPrincipalDueTime)"
      );

      assertEq(
        callableLoan.totalPrincipalPaid(),
        totalDeposits - drawdownAmount + paymentAllocation.additionalBalancePayment,
        "New principal paid"
      );

      callRequestPeriod = callableLoan.getCallRequestPeriod(0);
      assertEq(
        callRequestPeriod.principalDeposited - callRequestPeriod.principalPaid,
        (totalCalled).saturatingSub(paymentAllocation.additionalBalancePayment),
        "callRequestPeriod principal outstanding"
      );
      assertZero(callRequestPeriod.principalReserved, "callRequestPeriod principal Reserved");
      uncalledCapitalInfo = callableLoan.getUncalledCapitalInfo();
      assertZero(uncalledCapitalInfo.principalReserved, "uncalledCapitalInfo principal Reserved");

      assertApproxEqAbs(
        uncalledCapitalInfo.principalDeposited,
        totalDeposits - ((totalDeposits * (totalCalled)) / (drawdownAmount)),
        1,
        "\nUncalled principal deposited.\n"
        "See Tranche#take for calculation\n"
        "totalDeposits = uncalled principal deposited before call\n"
        "((totalDeposits * callAmount1) / (drawdownAmount)) = diff in principal deposited\n"
      );
      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        (totalDeposits * (totalCalled)) / (drawdownAmount),
        1,
        "\nCall request period principal deposited.\n"
        "See Tranche#take for calculation\n"
        "totalDeposits = uncalled principal deposited before call\n"
        "((totalDeposits * callAmount1) / (drawdownAmount)) = diff in principal deposited\n"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalPaid + callRequestPeriod.principalPaid,
        paymentAllocation.additionalBalancePayment + totalDeposits - drawdownAmount,
        1,
        "Total principal paid"
      );
      assertApproxEqAbs(
        callRequestPeriod.principalPaid,
        Math.min(paymentAllocation.additionalBalancePayment, totalCalled) +
          callRequestPeriod.principalDeposited -
          totalCalled,
        1,
        "\nCall request period principal paid.\n"
        "See Tranche#take for calculation\n"
        "principalPaidTaken = principalDepositedTaken - principalOutstandingToTake\n"
      );
    }
  }
}

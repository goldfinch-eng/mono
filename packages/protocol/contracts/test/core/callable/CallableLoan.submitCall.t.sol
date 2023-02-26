pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {ICallableLoan} from "../../../interfaces/ICallableLoan.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract CallableLoanSubmitCallTest is CallableLoanBaseTest {
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
  // Use storage buffer to get around Solidity stack size limits.
  uint principalAvailableToWithdraw;
  uint firstInterestAccrued;
  uint firstInterestOwedAtNextDueTime;
  uint firstInterestOwedAtNextPrincipalDueTime;
  uint originalBalance;
  uint loanContractBalanceBefore;
  uint userBalanceBefore;
  uint totalInterestPayment;
  uint totalPrincipalPayment;

  uint callAmount1Max;
  uint callAmount2Max;

  ILoan.PaymentAllocation paymentAllocation;

  function testSubmitCallScenario(
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
    warpToAfterDrawdownPeriod(callableLoan);

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

      callAmount1Max = (depositAmount1 * drawdownAmount) / totalDeposits;
      callAmount1 = bound(callAmount1, 0, callAmount1Max);
      if (callAmount1 > 0) {
        console.log("Submitting call 1");
        (user1PoolTokenIdCalledSplit, user1PoolTokenIdUncalledSplit) = submitCall(
          callableLoan,
          callAmount1,
          user1PoolTokenId,
          user1
        );
      }

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

      ICallableLoan.CallRequestPeriod memory crp = callableLoan.getCallRequestPeriod(0);

      assertEq(
        crp.principalDeposited - crp.principalPaid,
        callAmount1,
        "crp principal outstanding"
      );
      assertEq(crp.principalReserved, 0, "crp principal Reserved");
      assertEq(crp.interestPaid, 0, "crp interest paid");
    }

    /// Pay - After First Call Submission
    /// Assert payment updates accounting correctly.
    /// Use {} to produce new stack frame and avoid stack too deep errors.
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
      ICallableLoan.CallRequestPeriod memory crp = callableLoan.getCallRequestPeriod(0);

      assertEq(
        crp.principalDeposited - crp.principalPaid,
        callAmount1,
        "crp principal outstanding"
      );
      assertEq(
        crp.principalReserved,
        Math.min(callAmount1, paymentAllocation.additionalBalancePayment),
        "crp principal Reserved"
      );
      assertEq(
        crp.interestPaid,
        (paymentAllocation.accruedInterestPayment * (crp.principalDeposited - crp.principalPaid)) /
          (callableLoan.interestBearingBalance()),
        "crp interest paid"
      );
    }

    // /// Warp to before first payment period due date
    // /// Submit Call request 2 from user 2
    // /// Check that we update accounting correctly.
    // /// Use {} to produce new stack frame and avoid stack too deep errors.
    {
      uint interestOwedAtNextDueTime = callableLoan.interestOwedAt(callableLoan.nextDueTime());
      uint interestOwedAtNextPrincipalDueTime = callableLoan.interestOwedAt(
        callableLoan.nextPrincipalDueTime()
      );

      callAmount2Max =
        (depositAmount2 * (drawdownAmount - paymentAllocation.additionalBalancePayment)) /
        totalDeposits;
      callAmount2 = bound(callAmount2, 0, callAmount2Max);
      if (callAmount2 > 0) {
        console.log("Submitting call 2");
        (user2PoolTokenIdCalledSplit, user2PoolTokenIdUncalledSplit) = submitCall(
          callableLoan,
          callAmount2,
          user2PoolTokenId,
          user2
        );
      }

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
    }

    // // TODO:
    // /// Warp to first payment period due date
    vm.warp(callableLoan.nextPrincipalDueTime() - 1);
    vm.warp(callableLoan.nextPrincipalDueTime());
    // /// Assert that both users can withdraw expected amounts
    // /// Assert that second user cannot withdraw any amounts from their call requested token.
    // {

    // }
  }
}

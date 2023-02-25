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
  uint calcBuffer;
  uint firstInterestAccrued;
  uint firstInterestOwedAtNextDueTime;
  uint firstInterestOwedAtNextPrincipalDueTime;
  uint originalBalance;
  uint loanContractBalanceBefore;
  uint userBalanceBefore;
  uint totalInterestPayment;
  uint totalPrincipalPayment;

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

      calcBuffer = (depositAmount1 * drawdownAmount) / totalDeposits;
      callAmount1 = bound(callAmount1, 0, calcBuffer);
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
  }
}

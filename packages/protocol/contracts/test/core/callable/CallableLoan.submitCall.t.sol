pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {ILoan} from "../../../interfaces/ILoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";

contract CallableLoanSubmitCallTest is CallableLoanBaseTest {
  CallableLoan callableLoan;
  // Use storage array to get around Solidity stack size limits.
  uint[16] userPoolTokenIds;
  uint totalDeposits;

  function testSubmitCallMovesCapital(
    uint256 depositAmount1,
    uint256 depositAmount2,
    uint256 depositAmount3,
    uint256 callAmount1,
    address user1,
    address user2,
    address user3,
    uint256 drawdownAmount
  ) public {
    depositAmount1 = bound(depositAmount1, 1, usdcVal(100_000_000));
    depositAmount2 = bound(depositAmount2, 1, usdcVal(100_000_000));
    depositAmount3 = bound(depositAmount3, 1, usdcVal(100_000_000));
    totalDeposits = depositAmount1 + depositAmount2 + depositAmount3;

    drawdownAmount = bound(drawdownAmount, 1, depositAmount1 + depositAmount2 + depositAmount3);
    (CallableLoan callableLoan, ) = callableLoanWithLimit(
      depositAmount1 + depositAmount2 + depositAmount3
    );

    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    vm.assume(fuzzHelper.isAllowed(user3));

    uid._mintForTest(user1, 1, 1, "");
    uid._mintForTest(user2, 1, 1, "");
    uid._mintForTest(user3, 1, 1, "");

    userPoolTokenIds[0] = deposit(callableLoan, depositAmount1, user1);
    userPoolTokenIds[1] = deposit(callableLoan, depositAmount2, user2);
    userPoolTokenIds[2] = deposit(callableLoan, depositAmount3, user3);

    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);

    assertEq(
      callableLoan.totalPrincipalOwedAt(callableLoan.nextPrincipalDueTime()),
      0,
      "Original principal owed"
    );
    assertEq(
      callableLoan.totalPrincipalPaid(),
      (depositAmount1 + depositAmount2 + depositAmount3) - drawdownAmount,
      "Original principal paid"
    );
    assertEq(callableLoan.balance(), drawdownAmount, "Original balance");
    uint interestOwedAtNextDueTime = callableLoan.interestOwedAt(callableLoan.nextDueTime());
    uint interestOwedAtNextPrincipalDueTime = callableLoan.interestOwedAt(
      callableLoan.nextPrincipalDueTime()
    );

    callAmount1 = bound(callAmount1, 0, (depositAmount1 * drawdownAmount) / totalDeposits);
    if (callAmount1 > 0) {
      (userPoolTokenIds[3], userPoolTokenIds[4]) = submitCall(
        callableLoan,
        callAmount1,
        userPoolTokenIds[0],
        user1
      );
    }
    console.log("callAmount1: %s", callAmount1);
    console.log(
      "callableLoan.totalPrincipalOwedAt(callableLoan.nextPrincipalDueTime())",
      callableLoan.totalPrincipalOwedAt(callableLoan.nextPrincipalDueTime())
    );
    assertEq(
      callableLoan.totalPrincipalOwedAt(callableLoan.nextPrincipalDueTime()),
      callAmount1,
      "New principal owed"
    );
    assertEq(
      callableLoan.totalPrincipalPaid(),
      (depositAmount1 + depositAmount2 + depositAmount3) - drawdownAmount,
      "New principal paid"
    );
    assertEq(callableLoan.balance(), drawdownAmount, "New balance");
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
}

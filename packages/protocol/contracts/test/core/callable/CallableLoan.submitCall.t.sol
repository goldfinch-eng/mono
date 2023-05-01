// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {console2 as console} from "forge-std/console2.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICallableLoan, LoanPhase} from "../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSubmitCallTest is CallableLoanBaseTest {
  function testPoolTokenDustLimit() public {
    // TODO
  }

  function testDoesNotLetYouSubmitCallForPoolTokenYouDontOwn(
    address poolTokenOwner,
    address rando,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 secondsElapsedSinceDrawdownPeriod
  ) public {
    vm.assume(rando != poolTokenOwner);
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    // vm.assume after building callable loan to properly exclude contracts.
    vm.assume(fuzzHelper.isAllowed(poolTokenOwner));
    vm.assume(fuzzHelper.isAllowed(rando));

    uid._mintForTest(poolTokenOwner, 1, 1, "");
    uid._mintForTest(rando, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, poolTokenOwner);
    uint256 drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);
    drawdown(callableLoan, drawdownAmount);
    secondsElapsedSinceDrawdownPeriod = bound(
      secondsElapsedSinceDrawdownPeriod,
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS,
      callableLoan.termEndTime()
    );
    vm.warp(block.timestamp + secondsElapsedSinceDrawdownPeriod);
    vm.expectRevert(
      abi.encodeWithSelector(ICallableLoanErrors.NotAuthorizedToSubmitCall.selector, rando, token)
    );
    submitCall(callableLoan, depositAmount - drawdownAmount, token, rando);
  }

  function testDoesNotLetYouSubmitCallBeforeFirstDeposit(
    uint256 loanLimit,
    uint256 tokenId,
    uint256 callAmount,
    uint128 secondsElapsedSinceLoanConstruction,
    address caller
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(loanLimit);
    vm.warp(block.timestamp + secondsElapsedSinceLoanConstruction);
    // This state is so invalid there are many reasons it could revert.
    vm.expectRevert();
    submitCall(callableLoan, callAmount, tokenId, caller);
  }

  function testDoesNotLetYouSubmitCallBeforeFirstDrawdown(
    address depositor,
    uint256 depositAmount,
    uint256 callAmount,
    uint128 secondsElapsedSinceDeposit
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(depositor)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(depositor, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, depositor);
    uint256 callAmount = bound(callAmount, 1, depositAmount);
    vm.warp(block.timestamp + secondsElapsedSinceDeposit);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.ExcessiveCallSubmissionAmount.selector,
        token,
        callAmount,
        0
      )
    );
    submitCall(callableLoan, callAmount, token, depositor);
  }

  function testDoesNotLetYouSubmitCallAfterDrawdownBeforeLockupEnds(
    address depositor,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 secondsElapsedSinceDrawdown
  ) public {
    secondsElapsedSinceDrawdown = bound(
      secondsElapsedSinceDrawdown,
      0,
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(depositor)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(depositor, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, depositor);
    uint256 drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    uint256 callAmount = bound(callAmount, 1, drawdownAmount);
    drawdown(callableLoan, drawdownAmount);
    vm.warp(block.timestamp + secondsElapsedSinceDrawdown);

    if (depositAmount == drawdownAmount) {
      vm.expectRevert(
        abi.encodeWithSelector(
          ICallableLoanErrors.InvalidLoanPhase.selector,
          LoanPhase.DrawdownPeriod,
          LoanPhase.InProgress
        )
      );
    } else {
      vm.expectRevert(
        abi.encodeWithSelector(ICallableLoanErrors.CannotWithdrawInDrawdownPeriod.selector)
      );
    }

    submitCall(callableLoan, callAmount, token, depositor);
  }

  function testDoesNotLetYouSubmitCallDuringLockupPeriods(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 secondsElapsedAfterLockup,
    uint256 secondsElapsedAfterLastLockup
  ) public {
    secondsElapsedAfterLastLockup = bound(secondsElapsedAfterLastLockup, 0, 3650 days);
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    callAmount = bound(callAmount, 1, drawdownAmount);
    drawdown(callableLoan, drawdownAmount);

    // Lockup period of call request period 1
    vm.warp(callableLoan.nextDueTime());
    secondsElapsedAfterLockup = bound(
      secondsElapsedAfterLockup,
      block.timestamp,
      callableLoan.nextPrincipalDueTime() - 1
    );
    vm.warp(secondsElapsedAfterLockup);
    vm.expectRevert(ICallableLoanErrors.CannotSubmitCallInLockupPeriod.selector);
    submitCall(callableLoan, callAmount, token, user);

    // Lockup period of call request period 2
    vm.warp(callableLoan.nextPrincipalDueTime());
    vm.warp(callableLoan.nextDueTime());
    secondsElapsedAfterLockup = bound(
      secondsElapsedAfterLockup,
      block.timestamp,
      callableLoan.nextPrincipalDueTime() - 1
    );
    vm.warp(secondsElapsedAfterLockup);
    vm.expectRevert(ICallableLoanErrors.CannotSubmitCallInLockupPeriod.selector);
    submitCall(callableLoan, callAmount, token, user);

    // Lockup period of call request period 3
    vm.warp(callableLoan.nextPrincipalDueTime());
    vm.warp(callableLoan.nextDueTime());

    // Anything after call request period 3 would submit to uncalled tranche, and should be prohibited.
    vm.warp(block.timestamp + secondsElapsedAfterLastLockup);
    vm.expectRevert(ICallableLoanErrors.TooLateToSubmitCallRequests.selector);
    submitCall(callableLoan, callAmount, token, user);
  }

  function testDoesNotLetYouSubmitCallForMorePrincipalOutstandingThanIsAvailable(
    uint256 depositAmount,
    uint256 callAmount
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    callAmount = bound(callAmount, depositAmount + 1, usdcVal(100_000_000_000));
    (CallableLoan callableLoan, ) = callableLoanWithLimit(depositAmount);

    fundAddress(DEPOSITOR, depositAmount);

    uint uncalledTrancheIndex = callableLoan.uncalledCapitalTrancheIndex();
    _startImpersonation(DEPOSITOR);
    usdc.approve(address(callableLoan), depositAmount);
    uint256 tokenId = callableLoan.deposit(uncalledTrancheIndex, depositAmount);
    _stopImpersonation();

    _startImpersonation(BORROWER);
    callableLoan.drawdown(depositAmount);

    // this should be a unlocked period
    vm.warp(callableLoan.nextDueTime() - 1);
    _startImpersonation(DEPOSITOR);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.ExcessiveCallSubmissionAmount.selector,
        tokenId,
        callAmount,
        depositAmount
      )
    );
    callableLoan.submitCall(callAmount, tokenId);

    // leave 1 atom left in the call request
    uint256 validCallAmount = depositAmount - 1e6;
    (uint256 callRequestTokenId, uint256 remainingTokenId) = callableLoan.submitCall(
      validCallAmount,
      tokenId
    );

    uint remainingAmount = depositAmount - validCallAmount;
    uint invalidCallAmount = remainingAmount + 1;

    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.ExcessiveCallSubmissionAmount.selector,
        remainingTokenId,
        invalidCallAmount,
        remainingAmount
      )
    );
    callableLoan.submitCall(invalidCallAmount, remainingTokenId);
  }

  function testCallSplitsAvailableToWithdrawCorrectly(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 paymentAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    callAmount = bound(callAmount, 1, drawdownAmount);
    paymentAmount = bound(paymentAmount, 1, drawdownAmount);
    drawdown(callableLoan, drawdownAmount);
  }

  function testSubmitsCallForCorrectTranche(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 secondsElapsed
  ) public {
    // TODO(PR):
  }
}

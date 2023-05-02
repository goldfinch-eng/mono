// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {console2 as console} from "forge-std/console2.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICallableLoan, LoanPhase} from "../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {SaturatingSub} from "../../../library/SaturatingSub.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSubmitCallTest is CallableLoanBaseTest {
  using SaturatingSub for uint256;

  CallableLoan callableLoan;
  ICreditLine cl;

  // Used to avoid stack too deep errors in more complicated tests
  uint256 private availableInterest;
  uint256 private availablePrincipal;
  uint256 private calledTokenId;
  uint256 private remainderTokenId;
  uint256 private previousBalance;

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
    (callableLoan, cl) = callableLoanWithLimit(depositAmount);
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
    (callableLoan, cl) = callableLoanWithLimit(loanLimit);
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
    (callableLoan, cl) = callableLoanWithLimit(depositAmount);
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
    (callableLoan, cl) = callableLoanWithLimit(depositAmount);
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
    (callableLoan, cl) = callableLoanWithLimit(depositAmount);
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
    (callableLoan, ) = callableLoanWithLimit(depositAmount);

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

  function testSubmitCallWithdrawsAvailable(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 paymentAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    callAmount = bound(callAmount, 1, drawdownAmount);
    paymentAmount = bound(paymentAmount, 1, drawdownAmount);

    (callableLoan, cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);

    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    _startImpersonation(BORROWER);
    usdc.approve(address(callableLoan), paymentAmount);
    callableLoan.pay(paymentAmount);

    (availableInterest, availablePrincipal) = callableLoan.availableToWithdraw(token);
    previousBalance = usdc.balanceOf(user);

    _startImpersonation(user);
    (calledTokenId, remainderTokenId) = callableLoan.submitCall(callAmount, token);
    _stopImpersonation();

    secondsElapsed = bound(
      secondsElapsed,
      1,
      callableLoan.nextDueTimeAt(callableLoan.nextDueTime()) - block.timestamp
    );
    skip(secondsElapsed);

    assertApproxEqAbs(
      poolTokens.getTokenInfo(calledTokenId).principalAmount,
      (depositAmount * callAmount) / drawdownAmount,
      1,
      "Principal amount moved to called pool token is correct"
    );
    if (remainderTokenId != 0) {
      assertApproxEqAbs(
        poolTokens.getTokenInfo(remainderTokenId).principalAmount,
        depositAmount - (depositAmount * callAmount) / drawdownAmount,
        1,
        "Principal amount moved to uncalled pool token is correct"
      );
    }

    {
      (uint256 availableRemainderInterest, uint256 availableRemainderPrincipal) = callableLoan
        .availableToWithdraw(remainderTokenId);
      (uint256 availableCalledInterest, uint256 availableCalledPrincipal) = callableLoan
        .availableToWithdraw(calledTokenId);
      assertApproxEqAbs(
        availableRemainderInterest + availableCalledInterest,
        0,
        1,
        "Available interest to withdraw"
      );

      assertApproxEqAbs(
        availableRemainderPrincipal + availableCalledPrincipal,
        0,
        1,
        "Available principal to withdraw"
      );
      assertApproxEqAbs(
        usdc.balanceOf(user),
        previousBalance + availableInterest + availablePrincipal,
        1,
        "Difference in user balance"
      );
    }
  }

  function testPaymentIsAllocatedToCallsCorrectly(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 paymentAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    callAmount = bound(callAmount, 1, drawdownAmount);
    paymentAmount = bound(paymentAmount, 1, drawdownAmount);

    (callableLoan, cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);

    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    _startImpersonation(BORROWER);

    (availableInterest, availablePrincipal) = callableLoan.availableToWithdraw(token);
    previousBalance = usdc.balanceOf(user);

    _startImpersonation(user);
    (calledTokenId, remainderTokenId) = callableLoan.submitCall(callAmount, token);
    _stopImpersonation();

    secondsElapsed = bound(
      secondsElapsed,
      1,
      callableLoan.nextDueTimeAt(callableLoan.nextDueTime()) - block.timestamp
    );
    skip(secondsElapsed);

    uint256 totalInterestOwed = callableLoan.interestOwedAt(callableLoan.nextPrincipalDueTime());

    usdc.approve(address(callableLoan), paymentAmount);
    callableLoan.pay(paymentAmount);

    assertApproxEqAbs(
      poolTokens.getTokenInfo(calledTokenId).principalAmount,
      (depositAmount * callAmount) / drawdownAmount,
      1,
      "Principal amount moved to called pool token is correct"
    );
    if (remainderTokenId != 0) {
      assertApproxEqAbs(
        poolTokens.getTokenInfo(remainderTokenId).principalAmount,
        depositAmount - (depositAmount * callAmount) / drawdownAmount,
        1,
        "Principal amount moved to uncalled pool token is correct"
      );
    }

    {
      ICallableLoan.UncalledCapitalInfo memory uncalledCapitalInfo = callableLoan
        .getUncalledCapitalInfo();
      ICallableLoan.CallRequestPeriod memory callRequestPeriod = callableLoan.getCallRequestPeriod(
        0
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.principalDeposited,
        depositAmount - (depositAmount * callAmount) / drawdownAmount,
        1,
        "Uncalled principal deposited"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalPaid,
        (depositAmount - drawdownAmount) -
          (((depositAmount * callAmount) / drawdownAmount) - callAmount),
        1,
        "Uncalled principal paid"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalReserved,
        Math.min(
          paymentAmount.saturatingSub(totalInterestOwed).saturatingSub(callAmount),
          uncalledCapitalInfo.principalDeposited
        ),
        1,
        "Uncalled principal reserved"
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * uncalledCapitalInfo.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Uncalled interest paid"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        (depositAmount * callAmount) / drawdownAmount,
        1,
        "Called principal deposited"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalPaid,
        ((depositAmount * callAmount) / drawdownAmount) - callAmount,
        1,
        "Called principal paid"
      );
      assertApproxEqAbs(
        callRequestPeriod.principalReserved,
        Math.min(
          Math.min(callAmount, paymentAmount.saturatingSub(totalInterestOwed)),
          callRequestPeriod.principalDeposited
        ),
        1,
        "Called principal reserved"
      );
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * callRequestPeriod.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Called interest paid"
      );
      if (uncalledCapitalInfo.principalDeposited > 0) {
        assertOwedAmountsMatch(
          remainderTokenId,
          uncalledCapitalInfo.principalDeposited,
          uncalledCapitalInfo.interestPaid,
          uncalledCapitalInfo.principalPaid
        );
      }
      assertOwedAmountsMatch(
        calledTokenId,
        callRequestPeriod.principalDeposited,
        callRequestPeriod.interestPaid,
        callRequestPeriod.principalPaid
      );
    }

    // After principal reserved has been applied.
    vm.warp(callableLoan.nextPrincipalDueTime());
    {
      ICallableLoan.UncalledCapitalInfo memory uncalledCapitalInfo = callableLoan
        .getUncalledCapitalInfo();
      ICallableLoan.CallRequestPeriod memory callRequestPeriod = callableLoan.getCallRequestPeriod(
        0
      );

      assertZero(uncalledCapitalInfo.principalReserved);
      assertZero(callRequestPeriod.principalReserved);

      if (uncalledCapitalInfo.principalDeposited > 0) {
        assertOwedAmountsMatch(
          remainderTokenId,
          uncalledCapitalInfo.principalDeposited,
          uncalledCapitalInfo.interestPaid,
          uncalledCapitalInfo.principalPaid
        );
      }
      assertOwedAmountsMatch(
        calledTokenId,
        callRequestPeriod.principalDeposited,
        callRequestPeriod.interestPaid,
        callRequestPeriod.principalPaid
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.principalDeposited,
        depositAmount - (depositAmount * callAmount) / drawdownAmount,
        1,
        "Uncalled principal deposited"
      );
      assertApproxEqAbs(
        uncalledCapitalInfo.principalPaid,
        (depositAmount - drawdownAmount) -
          (((depositAmount * callAmount) / drawdownAmount) - callAmount) +
          Math.min(
            paymentAmount.saturatingSub(totalInterestOwed).saturatingSub(callAmount),
            uncalledCapitalInfo.principalDeposited
          ),
        1,
        "Uncalled principal paid"
      );

      assertApproxEqAbs(
        uncalledCapitalInfo.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * uncalledCapitalInfo.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Uncalled interest paid"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalDeposited,
        (depositAmount * callAmount) / drawdownAmount,
        1,
        "Called principal deposited"
      );

      assertApproxEqAbs(
        callRequestPeriod.principalPaid,
        ((depositAmount * callAmount) / drawdownAmount) -
          callAmount +
          Math.min(
            Math.min(callAmount, paymentAmount.saturatingSub(totalInterestOwed)),
            callRequestPeriod.principalDeposited
          ),
        1,
        "Called principal paid"
      );
      assertApproxEqAbs(
        callRequestPeriod.interestPaid,
        (Math.min(paymentAmount, totalInterestOwed) * callRequestPeriod.principalDeposited) /
          (uncalledCapitalInfo.principalDeposited + callRequestPeriod.principalDeposited),
        1,
        "Called interest paid"
      );
    }
  }

  function assertOwedInterestMatches(
    uint256 tokenId,
    uint256 principalDepositedInTranche,
    uint256 interestPaidInTranche,
    uint256 principalPaidInTranche
  ) internal {
    (uint256 availableInterest, uint256 availablePrincipal) = callableLoan.availableToWithdraw(
      tokenId
    );
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    assertApproxEqAbs(
      availableInterest,
      (interestPaidInTranche *
        tokenInfo.principalAmount *
        (100 - DEFAULT_RESERVE_FEE_DENOMINATOR)) / (principalDepositedInTranche * 100),
      1,
      "Owed interest matches"
    );
  }

  function assertOwedAmountsMatch(
    uint256 tokenId,
    uint256 principalDepositedInTranche,
    uint256 interestPaidInTranche,
    uint256 principalPaidInTranche
  ) internal {
    (uint256 availableInterest, uint256 availablePrincipal) = callableLoan.availableToWithdraw(
      tokenId
    );
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);

    assertApproxEqAbs(
      availableInterest,
      (interestPaidInTranche *
        tokenInfo.principalAmount *
        (100 - DEFAULT_RESERVE_FEE_DENOMINATOR)) / (principalDepositedInTranche * 100),
      1,
      "Owed interest matches"
    );

    assertApproxEqAbs(
      availablePrincipal,
      ((principalPaidInTranche * tokenInfo.principalAmount) / principalDepositedInTranche) -
        tokenInfo.principalRedeemed,
      1,
      "Owed principal matches"
    );
  }

  function testSubmitsCallForCorrectTranche(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 paymentAmount
  ) public {
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (callableLoan, cl) = callableLoanWithLimit(depositAmount * 4);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token1 = deposit(callableLoan, 3, depositAmount, user);
    uint256 token2 = deposit(callableLoan, 3, depositAmount, user);
    uint256 token3 = deposit(callableLoan, 3, depositAmount, user);

    deposit(callableLoan, 3, depositAmount, user);

    drawdownAmount = bound(drawdownAmount, usdcVal(1), depositAmount);
    paymentAmount = bound(paymentAmount, 1, drawdownAmount / 4);
    uint256 principalOutstanding = drawdownAmount - paymentAmount;
    callAmount = bound(callAmount, 4, principalOutstanding / 4);
    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    _startImpersonation(BORROWER);
    usdc.approve(address(callableLoan), paymentAmount);
    callableLoan.pay(paymentAmount);
    _stopImpersonation();

    _startImpersonation(user);
    (uint256 calledTokenId, uint256 uncalledTokenId) = callableLoan.submitCall(callAmount, token1);
    assertEq(
      poolTokens.getTokenInfo(calledTokenId).tranche,
      0,
      "First call request period should be tranche 0"
    );
    assertIsValidUncalledToken(uncalledTokenId);

    vm.warp(callableLoan.nextPrincipalDueTime());

    (calledTokenId, uncalledTokenId) = callableLoan.submitCall(callAmount, token2);
    assertEq(
      poolTokens.getTokenInfo(calledTokenId).tranche,
      1,
      "Second call request period should be tranche 1"
    );
    assertIsValidUncalledToken(uncalledTokenId);

    vm.warp(callableLoan.nextPrincipalDueTime());

    (calledTokenId, uncalledTokenId) = callableLoan.submitCall(callAmount, token3);
    assertEq(
      poolTokens.getTokenInfo(calledTokenId).tranche,
      2,
      "Third call request period should be tranche 2"
    );
    assertIsValidUncalledToken(uncalledTokenId);
  }

  function assertIsValidUncalledToken(uint256 tokenId) private {
    // Token ID == 0 means no token was created
    if (tokenId == 0) {
      return;
    }
    assertEq(
      poolTokens.getTokenInfo(tokenId).tranche,
      3,
      "Uncalled pool token should be uncalled capital tranche"
    );
  }
}

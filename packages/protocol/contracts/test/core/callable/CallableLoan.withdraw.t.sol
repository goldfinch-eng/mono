// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {console2 as console} from "forge-std/console2.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {LoanPhase} from "../../../interfaces/ICallableLoan.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanWithdrawTest is CallableLoanBaseTest {
  event WithdrawalMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 interestWithdrawn,
    uint256 principalWithdrawn
  );

  function testAvailableToWithdrawReturnsInterestAndPrincipalRedeemable(
    uint256 amount1,
    uint256 amount2,
    address otherDepositor
  ) public {
    amount1 = bound(amount1, usdcVal(1), usdcVal(1_000_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(1_000_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount1 + amount2);
    vm.assume(fuzzHelper.isAllowed(otherDepositor));

    uid._mintForTest(DEPOSITOR, 1, 1, "");
    uid._mintForTest(otherDepositor, 1, 1, "");

    uint256 token1 = deposit(callableLoan, 3, amount1, DEPOSITOR);
    uint256 token2 = deposit(callableLoan, 3, amount2, otherDepositor);

    drawdown(callableLoan, amount1 + amount2);

    {
      (uint256 interestRedeemable1, uint256 principalRedeemable1) = callableLoan
        .availableToWithdraw(token1);
      (uint256 interestRedeemable2, uint256 principalRedeemable2) = callableLoan
        .availableToWithdraw(token2);
      assertZero(principalRedeemable1);
      assertZero(principalRedeemable1);
      assertZero(interestRedeemable2);
      assertZero(principalRedeemable2);
    }

    vm.warp(cl.termEndTime());

    uint256 interestOwed = callableLoan.creditLine().interestOwed();
    pay(callableLoan, cl.interestOwed() + cl.principalOwed());
    assertZero(cl.interestOwed(), "Fully paid off interest");
    assertZero(cl.principalOwed(), "Fully paid off principal");

    uint256 protocolFee = interestOwed / 10;
    {
      (uint256 interestRedeemable1, uint256 principalRedeemable1) = callableLoan
        .availableToWithdraw(token1);
      (uint256 interestRedeemable2, uint256 principalRedeemable2) = callableLoan
        .availableToWithdraw(token2);
      assertEq(principalRedeemable1, amount1, "Principal redeemable for token 1");
      assertEq(principalRedeemable2, amount2, "Principal redeemable for token 2");
      assertApproxEqAbs(
        interestRedeemable1,
        ((interestOwed - protocolFee) * amount1) / (amount1 + amount2),
        HALF_CENT
      );
      assertApproxEqAbs(
        interestRedeemable2,
        ((interestOwed - protocolFee) * amount2) / (amount1 + amount2),
        HALF_CENT
      );
    }
  }

  function testWithdrawFailsIfNotGoListedAndWithoutAllowedUid(uint256 amount) public {
    amount = bound(amount, 1, usdc.balanceOf(GF_OWNER));

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount);
    _startImpersonation(BORROWER);
    uint256[] memory uids = new uint256[](1);
    uids[0] = 0;
    callableLoan.setAllowedUIDTypes(uids);
    _stopImpersonation();

    uint256 token = deposit(callableLoan, 3, amount, GF_OWNER);

    _startImpersonation(GF_OWNER);
    gfConfig.removeFromGoList(GF_OWNER);
    vm.expectRevert(
      abi.encodeWithSelector(ICallableLoanErrors.NotAuthorizedToWithdraw.selector, GF_OWNER, token)
    );
    callableLoan.withdraw(token, amount);
    _stopImpersonation();
  }

  function testWithdrawSucceedsForNonGoListedWithAllowedUid(address user, uint256 amount) public {
    amount = bound(amount, 1, usdcVal(1_000_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, callableLoan.uncalledCapitalTrancheIndex(), amount, user);
    assertEq(token, 1);

    (uint256 interestRedeemed, uint256 principalRedeemed) = withdraw(
      callableLoan,
      token,
      amount,
      user
    );
    assertZero(interestRedeemed);
    assertEq(principalRedeemed, amount);
  }

  function testWithdrawSucceedsWithMultipleDepositors(
    address depositor1,
    address depositor2,
    address depositor3,
    uint256 depositAmount1,
    uint256 depositAmount2,
    uint256 depositAmount3,
    uint256 drawdownAmount
  ) public {
    depositAmount1 = bound(depositAmount1, 1, usdcVal(1_000_000_000));
    depositAmount2 = bound(depositAmount2, 1, usdcVal(1_000_000_000));
    depositAmount3 = bound(depositAmount3, 1, usdcVal(1_000_000_000));
    bound(drawdownAmount, 1, usdcVal(1_000_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(
      depositAmount1 + depositAmount2 + depositAmount3
    );
    vm.assume(fuzzHelper.isAllowed(depositor1)); // Assume after building callable loan to properly exclude contracts.
    vm.assume(fuzzHelper.isAllowed(depositor2)); // Assume after building callable loan to properly exclude contracts.
    vm.assume(fuzzHelper.isAllowed(depositor3)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(depositor1, 1, 1, "");
    uid._mintForTest(depositor2, 1, 1, "");
    uid._mintForTest(depositor3, 1, 1, "");

    uint256 token1 = deposit(callableLoan, 3, depositAmount1, depositor1);
    uint256 token2 = deposit(callableLoan, 3, depositAmount2, depositor2);
    uint256 token3 = deposit(callableLoan, 3, depositAmount3, depositor3);

    {
      uint256 userBalance1 = usdc.balanceOf(depositor1);
      uint256 userBalance2 = usdc.balanceOf(depositor2);
      uint256 userBalance3 = usdc.balanceOf(depositor3);

      drawdown(callableLoan, depositAmount1 + depositAmount2 + depositAmount3);
    }

    callableLoan.withdrawMax(token1);
    callableLoan.withdrawMax(token2);
    callableLoan.withdrawMax(token3);
  }

  function testWithdrawFailsIfForNonPoolTokenOwner(
    address owner,
    uint256 amount,
    address withdrawer
  ) public {
    amount = bound(amount, 1, usdc.balanceOf(GF_OWNER));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount);
    vm.assume(fuzzHelper.isAllowed(owner));
    vm.assume(fuzzHelper.isAllowed(withdrawer));
    vm.assume(owner != withdrawer);
    uid._mintForTest(owner, 1, 1, "");
    uid._mintForTest(withdrawer, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, amount, owner);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.NotAuthorizedToWithdraw.selector,
        withdrawer,
        token
      )
    );
    withdraw(callableLoan, token, amount, withdrawer);
  }

  function testWithdrawFailsForPoolTokenFromDifferentPool(
    address user,
    uint256 amount1,
    uint256 amount2
  ) public {
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));
    (CallableLoan callableLoan1, ) = callableLoanWithLimit(amount1);
    (CallableLoan callableLoan2, ) = callableLoanWithLimit(amount2);

    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(user, 1, 1, "");

    uint256 token1 = deposit(callableLoan1, 3, amount1, user);
    uint256 token2 = deposit(callableLoan2, 3, amount2, user);

    // User can't use token2 to withdraw from callableLoan1
    vm.expectRevert("Invalid sender");
    withdraw(callableLoan1, token2, usdcVal(1), user);

    // User can't use token1 to withdraw from callableLoan2
    vm.expectRevert("Invalid sender");
    withdraw(callableLoan2, token1, usdcVal(1), user);
  }

  function testWithdrawFailsIfExceedsWithdrawable(address user, uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    withdraw(callableLoan, token, amount, user);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.WithdrawAmountExceedsWithdrawable.selector,
        usdcVal(1),
        0
      )
    );
    withdraw(callableLoan, token, usdcVal(1), user);
  }

  function testWithdrawFailsIfAttemptingToWithdrawZero(address user, uint256 depositAmount) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    vm.expectRevert(ICallableLoanErrors.ZeroWithdrawAmount.selector);
    withdraw(callableLoan, token, 0, user);
  }

  function testWithdrawBeforePoolLockedAllowsWithdrawalUpToMax(
    address user,
    uint256 depositAmount,
    uint256 withdrawAmount,
    uint256 timeBetweenDepositAndWithdraw
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_000));
    withdrawAmount = bound(withdrawAmount, usdcVal(1), depositAmount);
    // 180 days = Arbitrary "long" length of time.
    timeBetweenDepositAndWithdraw = bound(timeBetweenDepositAndWithdraw, 0, 180 days);
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    vm.warp(block.timestamp + timeBetweenDepositAndWithdraw);
    withdraw(callableLoan, token, withdrawAmount, user);
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(token);
    assertEq(tokenInfo.principalAmount, depositAmount - withdrawAmount);
  }

  function testDoesNotLetYouWithdrawAfterDrawdownBeforeLockupEnds(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 secondsElapsed
  ) public {
    secondsElapsed = bound(secondsElapsed, 0, DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    uint256 drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);
    drawdown(callableLoan, drawdownAmount);

    vm.warp(block.timestamp + secondsElapsed);
    vm.expectRevert(ICallableLoanErrors.CannotWithdrawInDrawdownPeriod.selector);
    withdraw(callableLoan, token, depositAmount - drawdownAmount, user);
  }

  function testLetsYouWithdrawAfterLockupEnds(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);
    secondsElapsed = bound(secondsElapsed, 0, 1000 days);

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);

    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(user, 1, 1, "");
    uint256 firstPoolToken = deposit(callableLoan, 3, depositAmount, user);
    drawdown(callableLoan, drawdownAmount);

    warpToAfterDrawdownPeriod(callableLoan);
    vm.warp(block.timestamp + secondsElapsed);

    withdraw(callableLoan, firstPoolToken, depositAmount - drawdownAmount, user);
    IPoolTokens.TokenInfo memory firstPoolTokenInfo = poolTokens.getTokenInfo(firstPoolToken);
    assertEq(firstPoolTokenInfo.principalAmount, depositAmount);
    assertEq(firstPoolTokenInfo.principalRedeemed, depositAmount - drawdownAmount);
  }

  function testWithdrawProRataPaymentShare(
    address user1,
    address user2,
    uint256 amount1,
    uint256 amount2
  ) public {
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount1 + amount2);
    vm.assume(user1 != user2);
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    uid._mintForTest(user1, 1, 1, "");
    uid._mintForTest(user2, 1, 1, "");
    uint256 token1 = deposit(callableLoan, 3, amount1, user1);
    uint256 token2 = deposit(callableLoan, 3, amount2, user2);

    drawdown(callableLoan, amount1 + amount2);

    vm.warp(cl.termEndTime());

    uint256 interestOwed = cl.interestOwed();

    pay(callableLoan, cl.interestOwed() + cl.principalOwed());

    {
      // Users should be able to withdraw their principal and interest redeemable
      // uint256 protocolFee = interestOwed / 10;
      // interestOwed - protcolFee = 9/10 * interestOwed (because protocol fee is 10%)
      // Depending on the fuzzed amounts, the interest calculation here could by overshot by 1.
      // Subtract by 1 to account for that.
      uint256 interest1 = (((interestOwed * 9) / 10) * amount1) / (amount1 + amount2) - 1;
      uint256 interest2 = (((interestOwed * 9) / 10) * amount2) / (amount1 + amount2) - 1;

      uint256 usdcBalanceBefore = usdc.balanceOf(user1);
      withdraw(callableLoan, token1, amount1 + interest1, user1);
      assertEq(usdc.balanceOf(user1), usdcBalanceBefore + amount1 + interest1);

      usdcBalanceBefore = usdc.balanceOf(user2);
      withdraw(callableLoan, token2, amount2 + interest2, user2);
      assertEq(usdc.balanceOf(user2), usdcBalanceBefore + amount2 + interest2);

      IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(token1);
      assertApproxEqAbs(tokenInfo.principalRedeemed, amount1, HALF_CENT);
      assertApproxEqAbs(tokenInfo.interestRedeemed, interest1, HALF_CENT);

      tokenInfo = poolTokens.getTokenInfo(token2);
      assertApproxEqAbs(tokenInfo.principalRedeemed, amount2, HALF_CENT);
      assertApproxEqAbs(tokenInfo.interestRedeemed, interest2, HALF_CENT);
    }

    (, uint interestOwedOnToken1) = callableLoan.availableToWithdraw(token1);
    // After withdrawing I shouldn't be able to withdraw more
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.WithdrawAmountExceedsWithdrawable.selector,
        HALF_CENT,
        interestOwedOnToken1
      )
    );
    withdraw(callableLoan, token1, HALF_CENT, user1);

    (, uint interestOwedOnToken2) = callableLoan.availableToWithdraw(token2);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.WithdrawAmountExceedsWithdrawable.selector,
        HALF_CENT,
        interestOwedOnToken2
      )
    );
    withdraw(callableLoan, token2, HALF_CENT, user2);
  }

  function testWithdrawEmitsAnEvent(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    drawdown(callableLoan, drawdownAmount);
    vm.warp(cl.termEndTime());
    uint256 interestOwed = cl.interestOwed();
    pay(callableLoan, interestOwed + drawdownAmount);

    uint256 withdrawableInterest = (interestOwed * (100 - DEFAULT_RESERVE_FEE_DENOMINATOR)) / 100;
    // Total amount owed
    vm.expectEmit(true, true, true, true);
    emit WithdrawalMade(user, 3, token, withdrawableInterest, depositAmount);
    withdraw(callableLoan, token, withdrawableInterest + depositAmount, user);
  }

  function testWithdrawMultipleRevertsIfAnyTokenNotOwnedByCaller(
    address user1,
    address user2,
    uint256 amount1,
    uint256 amount2
  ) public {
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount1 + amount2);
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    vm.assume(user1 != user2);
    uid._mintForTest(user1, 1, 1, "");
    uid._mintForTest(user2, 1, 1, "");
    uint256[] memory tokens = new uint256[](2);
    tokens[0] = deposit(callableLoan, 3, amount1, user1);
    tokens[1] = deposit(callableLoan, 3, amount2, user2);

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = amount1;
    amounts[1] = amount2;

    vm.expectRevert(
      abi.encodeWithSelector(ICallableLoanErrors.NotAuthorizedToWithdraw.selector, user1, tokens[1])
    );
    withdrawMultiple(callableLoan, tokens, amounts, user1);
    vm.expectRevert(
      abi.encodeWithSelector(ICallableLoanErrors.NotAuthorizedToWithdraw.selector, user2, tokens[0])
    );
    withdrawMultiple(callableLoan, tokens, amounts, user2);
  }

  function testWithdrawMultipleRevertsIfAnyTokenExceedsMaxWithdrawable(
    uint256 amount1,
    uint256 amount2,
    uint256 excessAmount
  ) public {
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));
    excessAmount = bound(excessAmount, usdcVal(1), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount1 + amount2);
    uint256[] memory tokens = new uint256[](2);
    tokens[0] = deposit(callableLoan, 3, amount1, GF_OWNER);
    tokens[1] = deposit(callableLoan, 3, amount2, GF_OWNER);
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = amount1 + excessAmount; // Exceeds max withdrawable
    amounts[1] = amount2;
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.WithdrawAmountExceedsWithdrawable.selector,
        amount1 + excessAmount,
        amount1
      )
    );
    withdrawMultiple(callableLoan, tokens, amounts, GF_OWNER);
  }

  function testWithdrawMultipleRevertsForArrayLengthMismatch(
    uint256[] memory tokens,
    uint256[] memory amounts
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(tokens.length != amounts.length);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.ArrayLengthMismatch.selector,
        tokens.length,
        amounts.length
      )
    );
    withdrawMultiple(callableLoan, tokens, amounts, GF_OWNER);
  }

  function testWithdrawMultipleSuccess(address user, uint256 amount1, uint256 amount2) public {
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));

    uint256[] memory tokens = new uint256[](2);

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(amount1 + amount2);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");

    tokens[0] = deposit(callableLoan, 3, amount1, user);
    tokens[1] = deposit(callableLoan, 3, amount2, user);

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = amount1;
    amounts[1] = amount2;

    uint256 usdcBalanceBefore = usdc.balanceOf(user);
    withdrawMultiple(callableLoan, tokens, amounts, user);
    assertEq(usdc.balanceOf(user), usdcBalanceBefore + amount1 + amount2);
    (, uint256 redeemablePrincipal) = callableLoan.availableToWithdraw(tokens[0]);
    assertZero(redeemablePrincipal);
    (, redeemablePrincipal) = callableLoan.availableToWithdraw(tokens[1]);
    assertZero(redeemablePrincipal);
  }

  function testWithdrawMaxFailsIfForNonPoolTokenOwner(
    address owner,
    uint256 amount,
    address withdrawer
  ) public {
    amount = bound(amount, 1, usdcVal(100_000_000));
    (CallableLoan callableLoan, ) = callableLoanWithLimit(amount);
    vm.assume(owner != withdrawer);
    vm.assume(fuzzHelper.isAllowed(owner));
    vm.assume(fuzzHelper.isAllowed(withdrawer));

    uid._mintForTest(owner, 1, 1, "");
    uid._mintForTest(withdrawer, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, amount, owner);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.NotAuthorizedToWithdraw.selector,
        withdrawer,
        token
      )
    );
    withdrawMax(callableLoan, token, withdrawer);
  }

  function testWithdrawMaxFailsForPoolTokenFromDifferentPool(address user, uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));

    (CallableLoan callableLoan1, ) = callableLoanWithLimit(amount);
    (CallableLoan callableLoan2, ) = callableLoanWithLimit(amount);

    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");

    uint256 token1 = deposit(callableLoan1, 3, amount, user);
    uint256 token2 = deposit(callableLoan2, 3, amount, user);

    // User can't use token2 to withdraw from callableLoan1
    vm.expectRevert("Invalid sender");
    withdrawMax(callableLoan1, token2, user);

    // User can't use token1 to withdraw from callableLoan2
    vm.expectRevert(bytes("Invalid sender"));
    withdrawMax(callableLoan2, token1, user);
  }

  function testWithdrawMaxFailsIfNoAmountsAvailable(address user, uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    (CallableLoan callableLoan, ) = callableLoanWithLimit(amount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    withdrawMax(callableLoan, token, user);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.WithdrawAmountExceedsWithdrawable.selector,
        usdcVal(1),
        0
      )
    );
    withdraw(callableLoan, token, usdcVal(1), user);
  }

  function testWithdrawMaxBeforePoolLockedAllowsWithdrawl(address user, uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    (CallableLoan callableLoan, ) = callableLoanWithLimit(amount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    withdrawMax(callableLoan, token, user);
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(token);
    assertZero(tokenInfo.principalAmount);
  }

  function testDoesNotLetYouWithdrawMaxAfterDrawdownBeforeLockupEnds(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    (CallableLoan callableLoan, ) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    secondsElapsed = bound(secondsElapsed, 0, DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);

    uid._mintForTest(user, 1, 1, "");
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);
    uint256 poolToken = deposit(callableLoan, depositAmount, user);
    drawdown(callableLoan, drawdownAmount);
    vm.warp(block.timestamp + secondsElapsed);

    vm.expectRevert(ICallableLoanErrors.CannotWithdrawInDrawdownPeriod.selector);
    withdrawMax(callableLoan, poolToken, user);
  }

  function testLetsYouWithdrawMaxOfNonDrawndownAfterLockupEnds(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_000));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);

    (CallableLoan callableLoan, ) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    secondsElapsed = bound(secondsElapsed, 0, 1000 days);

    uid._mintForTest(user, 1, 1, "");
    uint256 poolToken = deposit(callableLoan, depositAmount, user);
    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    vm.warp(block.timestamp + secondsElapsed);

    withdrawMax(callableLoan, poolToken, user);
    IPoolTokens.TokenInfo memory poolTokenInfo = poolTokens.getTokenInfo(poolToken);
    assertEq(poolTokenInfo.principalRedeemed, depositAmount - drawdownAmount);
  }

  function testLetsYouWithdrawMaxAfterLockupEnds(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 secondsElapsed
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_000));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);

    (CallableLoan callableLoan, ) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    secondsElapsed = bound(secondsElapsed, 0, 1000 days);

    uid._mintForTest(user, 1, 1, "");
    uint256 poolToken = deposit(callableLoan, depositAmount, user);
    drawdown(callableLoan, drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    vm.warp(block.timestamp + secondsElapsed);
    uint256 nextPrincipalDueTime = callableLoan.nextPrincipalDueTime();
    uint256 interestOwed;

    if (nextPrincipalDueTime > block.timestamp) {
      // If we are before the termEndTime
      assertLt(block.timestamp, callableLoan.termEndTime());
      interestOwed = callableLoan.interestOwedAt(callableLoan.nextPrincipalDueTime());
      pay(callableLoan, drawdownAmount + interestOwed);
      vm.warp(nextPrincipalDueTime);
    } else {
      assertGe(block.timestamp, callableLoan.termEndTime());
      // If we are after the termEndTime
      interestOwed = callableLoan.interestOwed();
      pay(callableLoan, drawdownAmount + interestOwed);
    }

    withdrawMax(callableLoan, poolToken, user);
    IPoolTokens.TokenInfo memory poolTokenInfo = poolTokens.getTokenInfo(poolToken);
    assertEq(poolTokenInfo.principalRedeemed, depositAmount, "principal redeemed");
    assertApproxEqAbs(
      poolTokenInfo.interestRedeemed,
      (interestOwed * (100 - DEFAULT_RESERVE_FEE_DENOMINATOR)) / 100,
      HUNDREDTH_CENT,
      "interest owed"
    );
  }

  function testWithdrawMaxEmitsEvent(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    drawdown(callableLoan, drawdownAmount);
    vm.warp(cl.termEndTime());
    uint256 interestOwed = cl.interestOwed();
    pay(callableLoan, interestOwed + drawdownAmount);

    uint256 withdrawableInterest = (interestOwed * (100 - DEFAULT_RESERVE_FEE_DENOMINATOR)) / 100;
    // Total amount owed
    vm.expectEmit(true, true, true, true);
    emit WithdrawalMade(user, 3, token, withdrawableInterest, depositAmount);
    withdrawMax(callableLoan, token, user);
  }

  function testWithdrawMaxLetsYouWithdrawUnusedAmounts(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount
  ) public {
    depositAmount = bound(depositAmount, usdcVal(100), usdcVal(10_000_000));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount);

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);

    drawdown(callableLoan, drawdownAmount);
    vm.warp(cl.termEndTime());

    // Depositors should be able to withdraw capital which was not drawn down.
    if (drawdownAmount < depositAmount) {
      (uint256 interestRedeemed, uint256 principalRedeemed) = withdrawMax(
        callableLoan,
        token,
        user
      );
      assertZero(interestRedeemed);
      assertEq(principalRedeemed, depositAmount - drawdownAmount);
    }

    uint256 interestOwed = cl.interestOwed();
    // fully pay off the loan
    pay(callableLoan, interestOwed + cl.principalOwed());
    // remaining 20% of principal should be withdrawn
    (uint256 interestRedeemed, uint256 principalRedeemed) = withdrawMax(callableLoan, token, user);
    assertEq(principalRedeemed, drawdownAmount);
    assertEq(interestRedeemed, (interestOwed * (100 - DEFAULT_RESERVE_FEE_DENOMINATOR)) / 100);
  }
}

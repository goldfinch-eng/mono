// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {console2 as console} from "forge-std/console2.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

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
    vm.assume(fuzzHelper.isAllowed(otherDepositor));

    uid._mintForTest(DEPOSITOR, 1, 1, "");
    uid._mintForTest(otherDepositor, 1, 1, "");

    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();

    uint256 token1 = deposit(callableLoan, 3, amount1, DEPOSITOR);
    uint256 token2 = deposit(callableLoan, 3, amount2, otherDepositor);

    // TODO: Drawdown to lock pool    // Amounts available to withdraw should be 0 when the pool is locked
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

    setMaxLimit(callableLoan, amount1 + amount2);
    setLimit(callableLoan, amount1 + amount2);
    drawdown(callableLoan, amount1 + amount2);
    vm.warp(cl.termEndTime());

    uint256 interestOwed = callableLoan.creditLine().interestOwed();
    pay(callableLoan, cl.interestOwed() + cl.principalOwed());
    assertZero(cl.interestOwed());
    assertZero(cl.principalOwed());

    // Total interest owed to junior:
    //  interest_accrued = amount1 + amount2 * 0.05
    //  protocol_fee = interest_accrued * 0.1
    //  interest_accrued - protocol_fee
    // Interest owed to individual junior depositor
    //  total_junior_interest * % of deposit
    uint256 protocolFee = interestOwed / 10;
    {
      (uint256 interestRedeemable1, uint256 principalRedeemable1) = callableLoan
        .availableToWithdraw(token1);
      (uint256 interestRedeemable2, uint256 principalRedeemable2) = callableLoan
        .availableToWithdraw(token2);
      assertEq(principalRedeemable1, amount1);
      assertEq(principalRedeemable2, amount2);
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

    (CallableLoan callableLoan, ) = defaultCallableLoan();
    _startImpersonation(BORROWER);
    uint256[] memory uids = new uint256[](1);
    uids[0] = 0;
    callableLoan.setAllowedUIDTypes(uids);
    _stopImpersonation();

    uint256 token = deposit(callableLoan, 3, amount, GF_OWNER);

    _startImpersonation(GF_OWNER);
    gfConfig.removeFromGoList(GF_OWNER);
    vm.expectRevert(bytes("NA"));
    callableLoan.withdraw(token, amount);
    _stopImpersonation();
  }

  function testWithdrawSucceedsForNonGoListedWithAllowedUid(address user, uint256 amount) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, 1, usdc.balanceOf(GF_OWNER));
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    assertEq(token, 1);
  }

  function testWithdrawFailsIfForNonPoolTokenOwner(
    address owner,
    uint256 amount,
    address withdrawer
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(owner));
    vm.assume(fuzzHelper.isAllowed(withdrawer));
    vm.assume(owner != withdrawer);
    amount = bound(amount, 1, usdc.balanceOf(GF_OWNER));

    uid._mintForTest(owner, 1, 1, "");
    uid._mintForTest(withdrawer, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, amount, owner);
    vm.expectRevert(bytes("NA"));
    withdraw(callableLoan, token, amount, withdrawer);
  }

  function testWithdrawFailsForPoolTokenFromDifferentPool(
    address user,
    uint256 amount1,
    uint256 amount2
  ) public {
    (CallableLoan callableLoan1, ) = defaultCallableLoan();
    (CallableLoan callableLoan2, ) = defaultCallableLoan();

    vm.assume(fuzzHelper.isAllowed(user));
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));

    uid._mintForTest(user, 1, 1, "");

    uint256 token1 = deposit(callableLoan1, 1, amount1, user);
    uint256 token2 = deposit(callableLoan2, 1, amount2, user);

    // User can't use token2 to withdraw from callableLoan1
    vm.expectRevert("Invalid sender");
    withdraw(callableLoan1, token2, usdcVal(1), user);

    // User can't use token1 to withdraw from callableLoan2
    vm.expectRevert("Invalid sender");
    withdraw(callableLoan2, token1, usdcVal(1), user);
  }

  function testWithdrawFailsIfNoAmountsAvailable(address user, uint256 amount) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    withdraw(callableLoan, token, amount, user);
    vm.expectRevert(bytes("IA"));
    withdraw(callableLoan, token, usdcVal(1), user);
  }

  function testWithdrawFailsIfAttemptingToWithdrawZero(address user, uint256 amount) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    vm.expectRevert(bytes("ZA"));
    withdraw(callableLoan, token, 0, user);
  }

  function testWithdrawBeforePoolLockedAllowsWithdrawalUpToMax(
    address user,
    uint256 depositAmount,
    uint256 withdrawAmount
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_000));
    withdrawAmount = bound(withdrawAmount, usdcVal(1), depositAmount);
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    withdraw(callableLoan, token, withdrawAmount, user);
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(token);
    assertEq(tokenInfo.principalAmount, depositAmount - withdrawAmount);
  }

  function testDoesNotLetYouWithdrawBeforeLockupEnds(
    address user,
    uint256 depositAmount,
    uint256 secondsElapsed
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    secondsElapsed = bound(secondsElapsed, 0, DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);

    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, user);

    vm.warp(block.timestamp + secondsElapsed);

    // TODO: Drawdown to lock pool
    vm.expectRevert(bytes("TL"));
    withdraw(callableLoan, token, depositAmount, user);
  }

  function testLetsYouWithdrawAfterLockupEnds(
    address user,
    uint256 depositAmount,
    uint256 secondsElapsed
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    secondsElapsed = bound(secondsElapsed, DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS + 1, 1000 days);

    uid._mintForTest(user, 1, 1, "");
    uint256 juniorToken = deposit(callableLoan, 3, depositAmount, user);
    // TODO: Drawdown to lock pool

    vm.warp(block.timestamp + secondsElapsed);

    withdraw(callableLoan, juniorToken, depositAmount, user);
    IPoolTokens.TokenInfo memory juniorTokenInfo = poolTokens.getTokenInfo(juniorToken);
    assertEq(juniorTokenInfo.principalAmount, depositAmount);
    assertEq(juniorTokenInfo.principalRedeemed, depositAmount);
  }

  function testWithdrawProRataPaymentShare(
    address user1,
    address user2,
    uint256 amount1,
    uint256 amount2
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.assume(user1 != user2);
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));
    uid._mintForTest(user1, 1, 1, "");
    uid._mintForTest(user2, 1, 1, "");

    uint256 token1 = deposit(callableLoan, 3, amount1, user1);
    uint256 token2 = deposit(callableLoan, 3, amount2, user2);

    setMaxLimit(callableLoan, amount1 + amount2);
    setLimit(callableLoan, amount1 + amount2);
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

    // After withdrawing I shouldn't be able to withdraw more
    vm.expectRevert(bytes("IA"));
    withdraw(callableLoan, token1, HALF_CENT, user1);
    vm.expectRevert(bytes("IA"));
    withdraw(callableLoan, token2, HALF_CENT, user2);
  }

  function testWithdrawEmitsAnEvent(address user) public {
    vm.warp(1672531143); // December 31st 11:59:59. Minimize the stub period

    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    uid._mintForTest(user, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, usdcVal(1000), user);
    drawdown(callableLoan, usdcVal(1000));
    vm.warp(cl.termEndTime());
    pay(callableLoan, cl.interestOwed() + cl.principalOwed());

    // Total amount owed to junior:
    //   principal = 1000
    //   interest_accrued = 1000 * 0.05 = 50
    //   protocol_fee = interest_accrued * 0.1 = 5
    //   principal + interest_accrued - protocol_fee = 1045
    vm.expectEmit(true, true, true, true);
    // Interest amount is slightly more than $45 due to the stub period
    emit WithdrawalMade(user, 1, token, 45000081, usdcVal(1000));
    // Total redeemable is slightly more than $1045 due to the stub period
    withdraw(callableLoan, token, 1045000081, user);
  }

  function testWithdrawMultipleRevertsIfAnyTokenNotOwnedByCaller(
    address user1,
    address user2,
    uint256 amount1,
    uint256 amount2
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    vm.assume(user1 != user2);
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));

    uid._mintForTest(user1, 1, 1, "");
    uid._mintForTest(user2, 1, 1, "");

    uint256[] memory tokens = new uint256[](2);
    tokens[0] = deposit(callableLoan, 3, amount1, user1);
    tokens[1] = deposit(callableLoan, 3, amount2, user2);

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = amount1;
    amounts[1] = amount2;

    vm.expectRevert(bytes("NA"));
    withdrawMultiple(callableLoan, tokens, amounts, user1);
    vm.expectRevert(bytes("NA"));
    withdrawMultiple(callableLoan, tokens, amounts, user2);
  }

  function testWithdrawMultipleRevertsIfAnyTokenExceedsMaxWithdrawable(
    uint256 amount1,
    uint256 amount2
  ) public {
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uint256[] memory tokens = new uint256[](2);
    tokens[0] = deposit(callableLoan, 3, amount1, GF_OWNER);
    tokens[1] = deposit(callableLoan, 3, amount2, GF_OWNER);
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = amount1 + 1; // Exceeds max withdrawable
    amounts[1] = amount2;
    vm.expectRevert(bytes("IA"));
    withdrawMultiple(callableLoan, tokens, amounts, GF_OWNER);
  }

  function testWithdrawMultipleRevertsForArrayLengthMismatch(
    uint256[] memory tokens,
    uint256[] memory amounts
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(tokens.length != amounts.length);
    vm.expectRevert(bytes("LEN"));
    withdrawMultiple(callableLoan, tokens, amounts, GF_OWNER);
  }

  function testWithdrawMultipleSuccess(address user, uint256 amount1, uint256 amount2) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount1 = bound(amount1, usdcVal(1), usdcVal(100_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(100_000_000));
    uid._mintForTest(user, 1, 1, "");

    uint256[] memory tokens = new uint256[](2);
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
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(owner != withdrawer);
    vm.assume(fuzzHelper.isAllowed(owner));
    vm.assume(fuzzHelper.isAllowed(withdrawer));
    amount = bound(amount, 1, usdcVal(100_000_000));

    uid._mintForTest(owner, 1, 1, "");
    uid._mintForTest(withdrawer, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, amount, owner);
    vm.expectRevert(bytes("NA"));
    withdrawMax(callableLoan, token, withdrawer);
  }

  function testWithdrawMaxFailsForPoolTokenFromDifferentPool(address user, uint256 amount) public {
    (CallableLoan callableLoan1, ) = defaultCallableLoan();
    (CallableLoan callableLoan2, ) = defaultCallableLoan();
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    vm.assume(fuzzHelper.isAllowed(user));

    uid._mintForTest(user, 1, 1, "");

    uint256 token1 = deposit(callableLoan1, 1, amount, user);
    uint256 token2 = deposit(callableLoan2, 1, amount, user);

    // User can't use token2 to withdraw from callableLoan1
    vm.expectRevert("Invalid sender");
    withdrawMax(callableLoan1, token2, user);

    // User can't use token1 to withdraw from callableLoan2
    vm.expectRevert(bytes("Invalid sender"));
    withdrawMax(callableLoan2, token1, user);
  }

  function testWithdrawMaxFailsIfNoAmountsAvailable(address user, uint256 amount) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    withdrawMax(callableLoan, token, user);
    vm.expectRevert(bytes("IA"));
    withdraw(callableLoan, token, usdcVal(1), user);
  }

  function testWithdrawMaxBeforePoolLockedAllowsWithdrawl(address user, uint256 amount) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, amount, user);
    withdrawMax(callableLoan, token, user);
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(token);
    assertZero(tokenInfo.principalAmount);
  }

  function testDoesNotLetYouWithdrawMaxBeforeLockupEnds(
    address user,
    uint256 amount,
    uint256 secondsElapsed
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(100_000_100));
    secondsElapsed = bound(secondsElapsed, 0, DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);

    uid._mintForTest(user, 1, 1, "");
    uint256 juniorToken = deposit(callableLoan, 3, amount, user);
    // TODO: Drawdown to lock pool
    vm.warp(block.timestamp + secondsElapsed);

    vm.expectRevert(bytes("TL"));
    withdrawMax(callableLoan, juniorToken, user);
  }

  function testLetsYouWithdrawMaxAfterLockupEnds(
    address user,
    uint256 amount,
    uint256 secondsElapsed
  ) public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(100_000_000));
    secondsElapsed = bound(secondsElapsed, DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS + 1, 1000 days);

    uid._mintForTest(user, 1, 1, "");
    uint256 juniorToken = deposit(callableLoan, 3, amount, user);
    // TODO: Drawdown to lock pool

    vm.warp(block.timestamp + secondsElapsed);

    withdrawMax(callableLoan, juniorToken, user);
    IPoolTokens.TokenInfo memory juniorTokenInfo = poolTokens.getTokenInfo(juniorToken);
    assertEq(juniorTokenInfo.principalRedeemed, amount);
  }

  function testWithdrawMaxEmitsEvent(address user) public {
    vm.warp(1672531143); // December 31st 11:59:59. Minimize the stub period

    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    uid._mintForTest(user, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, usdcVal(1000), user);
    drawdown(callableLoan, usdcVal(1000));
    vm.warp(cl.termEndTime());
    // Pay back
    pay(callableLoan, cl.interestOwed() + cl.principalOwed());
    vm.expectEmit(true, true, true, true);
    // Interest is slightly more than $45 due to the stub period
    emit WithdrawalMade(user, 1, token, 45000081, usdcVal(1000));
    withdrawMax(callableLoan, token, user);
  }

  function testWithdrawMaxLetsYouWithdrawUnusedAmountsWhenDepositsAreOverLimit(
    address user,
    uint256 limit
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    limit = bound(limit, usdcVal(100), usdcVal(10_000_000));
    setMaxLimit(callableLoan, limit);
    setLimit(callableLoan, limit);
    uid._mintForTest(user, 1, 1, "");
    uint256 overLimitDepositAmount = limit * 4;
    uint256 token = deposit(callableLoan, 3, overLimitDepositAmount, user);
    drawdown(callableLoan, limit);
    vm.warp(cl.termEndTime());

    // Depositors should be able to withdraw capital which was not drawn down.
    (uint256 interestRedeemed, uint256 principalRedeemed) = withdrawMax(callableLoan, token, user);
    assertZero(interestRedeemed);
    assertEq(principalRedeemed, overLimitDepositAmount - limit);

    // fully pay off the loan
    pay(callableLoan, cl.interestOwed() + cl.principalOwed());
    // remaining 20% of principal should be withdrawn
    (, principalRedeemed) = withdrawMax(callableLoan, token, user);
    assertEq(principalRedeemed, limit);
  }
}

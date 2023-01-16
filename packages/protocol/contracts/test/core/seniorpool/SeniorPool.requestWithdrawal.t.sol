// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {TestSeniorPoolCaller} from "../../../test/TestSeniorPoolCaller.sol";

contract SeniorPoolRequestWithdrawalTest is SeniorPoolBaseTest {
  function testRequestWithdrawalEoaWorksGoListed(address user, uint256 amount) public {
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    addToGoList(user);
    fundAddress(user, amount);

    depositToSpFrom(user, amount);

    uint256 requestToken = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(user, requestTokens.ownerOf(requestToken));
  }

  function testRequestWithdrawalEoaWorksWithValidUid(
    address user,
    uint256 amount,
    uint256 uidType
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    uidType = bound(uidType, 1, 4);
    vm.assume(uidType != 2);

    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    uniqueIdentity._mintForTest(user, uidType, 1, "");
    assertEq(uniqueIdentity.balanceOf(user, uidType), 1);
    fundAddress(user, amount);

    depositToSpFrom(user, amount);

    uint256 requestToken = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(user, requestTokens.ownerOf(requestToken));
  }

  function testRequestWithdrawalRevertsForInvalidUid(
    address user,
    uint256 amount,
    uint256 invalidUidType
  ) public onlyAllowListed(user) {
    invalidUidType = bound(invalidUidType, 5, type(uint256).max);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    uniqueIdentity._mintForTest(user, 1, 1, "");
    fundAddress(user, amount);

    depositToSpFrom(user, amount);

    burnUid(user, 1);
    uniqueIdentity._mintForTest(user, invalidUidType, 1, "");

    uint256 withdrawAmount = sp.getNumShares(amount);
    vm.expectRevert(bytes("NA"));
    requestWithdrawalFrom(user, withdrawAmount);
  }

  function testRequestWithdrawalRevertsForNoUidAndNoGoList(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    uniqueIdentity._mintForTest(user, 1, 1, "");
    fundAddress(user, amount);
    depositToSpFrom(user, amount);

    burnUid(user, 1);
    uint256 withdrawAmount = sp.getNumShares(amount);
    vm.expectRevert(bytes("NA"));
    requestWithdrawalFrom(user, withdrawAmount);
  }

  function testRequestWithdrawalFailsWhenCallerIsErc1155ApprovedForInvalidUid(
    uint256 amount,
    uint256 invalidUid
  ) public {
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    uniqueIdentity._mintForTest(address(this), 1, 1, "");
    fundAddress(address(this), amount);
    approveTokensMaxAmount(address(this));
    depositToSpFrom(address(this), amount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    uint256 shares = sp.getNumShares(amount);
    transferFidu(address(this), address(caller), shares);

    burnUid(address(this), 1);
    uniqueIdentity._mintForTest(address(this), invalidUid, 1, "");

    _startImpersonation(address(this), address(this));
    vm.expectRevert(bytes("NA"));
    caller.requestWithdrawal(shares);
  }

  function testRequestWithdrawalFailsWhenOriginHasValidUidButCallerHasNothing(
    uint256 amount,
    uint256 validUid
  ) public {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(address(this));
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    fundAddress(address(this), amount);
    depositToSpFrom(address(this), amount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    uint256 shares = sp.getNumShares(amount);
    transferFidu(address(this), address(caller), shares);

    approveForAll(address(this), address(caller), false);
    _startImpersonation(address(this), address(this));
    vm.expectRevert(bytes("NA"));
    caller.requestWithdrawal(shares);
  }

  function testRequestWithdrawalWorksWhenOriginHasNothingAndCallerIsGoListed(
    uint256 amount
  ) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    fundAddress(address(caller), amount);
    caller.deposit(amount);
    uint256 shares = sp.getNumShares(amount);
    uint256 tokenId = caller.requestWithdrawal(shares);
    assertEq(address(caller), requestTokens.ownerOf(tokenId));
  }

  /*================================================================================
  Request Withdrawal Tests
  ================================================================================*/

  function testRequestWithdrawalRevertsForOutstandingRequest(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) {
    amount = bound(amount, usdcVal(2), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, amount);
    sp.deposit(amount);
    sp.requestWithdrawal(fiduVal(1));
    vm.expectRevert("Existing request");
    sp.requestWithdrawal(fiduVal(1));
  }

  function testRequestWithdrawalSuccess(
    address user,
    uint256 depositAmount,
    uint256 requestAmount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    requestAmount = bound(requestAmount, usdcVal(1), depositAmount);
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);
    sp.deposit(depositAmount);
    uint256 shares = sp.getNumShares(requestAmount);

    vm.expectEmit(true, true, true, true, address(sp));
    emit WithdrawalRequested(1, 1, user, shares);
    assertZero(requestTokens.balanceOf(user));
    uint256 spFiduBefore = fidu.balanceOf(address(sp));
    uint256 userFiduBefore = fidu.balanceOf(user);

    uint256 tokenId = sp.requestWithdrawal(shares);
    assertEq(requestTokens.balanceOf(user), 1);
    assertEq(requestTokens.ownerOf(tokenId), user);
    assertEq(fidu.balanceOf(address(sp)), spFiduBefore + shares);
    assertEq(fidu.balanceOf(user), userFiduBefore - shares);
    ISeniorPoolEpochWithdrawals.Epoch memory epoch = sp.epochAt(1);
    assertEq(epoch.fiduRequested, shares);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.fiduRequested, shares);
    assertZero(request.usdcWithdrawable);
  }

  function testRequestWithdrawalCannotRequestMoreThanYourFiduBalance(
    address user,
    uint256 depositAmount,
    uint256 requestAmount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    requestAmount = bound(requestAmount, depositAmount + usdcVal(1), depositAmount * 10);

    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);
    sp.deposit(depositAmount);
    uint256 shares = sp.getNumShares(requestAmount);

    vm.expectRevert("SafeERC20: low-level call failed");
    sp.requestWithdrawal(shares);
  }

  function testRequestWithdrawalLiquidatesIfOneOrMoreEpochsHaveEndedSinceLastCheckpoint(
    address user1,
    uint256 depositAmount1,
    uint256 requestAmount1,
    address user2,
    uint256 depositAmount2,
    uint256 requestAmount2,
    uint256 epochsElapsed
  ) public {
    vm.assume(user1 != user2);
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));

    addToGoList(user1);
    addToGoList(user2);

    epochsElapsed = bound(epochsElapsed, 1, 10);

    depositAmount1 = bound(depositAmount1, usdcVal(1), usdcVal(10_000_000));
    depositAmount2 = bound(depositAmount2, usdcVal(1), usdcVal(10_000_000));

    requestAmount1 = bound(requestAmount1, usdcVal(1), depositAmount1);
    requestAmount2 = bound(requestAmount2, usdcVal(1), depositAmount2);

    fundAddress(user1, depositAmount1);
    fundAddress(user2, depositAmount2);

    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);

    depositToSpFrom(user1, depositAmount1);
    depositToSpFrom(user2, depositAmount2);

    uint256 requestAmount1InFidu = sp.getNumShares(requestAmount1);
    requestWithdrawalFrom(user1, requestAmount1InFidu);

    vm.warp(block.timestamp + sp.epochDuration() * epochsElapsed);

    uint256 requestAmount2InFidu = sp.getNumShares(requestAmount2);
    // This deposit should trigger a liquidation
    requestWithdrawalFrom(user2, requestAmount2InFidu);

    assertEq(sp.usdcAvailable(), depositAmount1 + depositAmount2 - requestAmount1);

    ISeniorPoolEpochWithdrawals.Epoch memory liquidatedEpoch = sp.epochAt(1);

    assertEq(liquidatedEpoch.usdcAllocated, requestAmount1);
    assertEq(liquidatedEpoch.fiduRequested, requestAmount1InFidu);
    assertEq(liquidatedEpoch.fiduLiquidated, requestAmount1InFidu);
  }

  function testRequestWithdrawalSucceedsWhenCallerIsErc1155ApprovedForValidUid(
    uint256 amount,
    uint256 validUid
  ) public {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(address(this));
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    fundAddress(address(this), amount);
    depositToSpFrom(address(this), amount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    uint256 shares = sp.getNumShares(amount);
    transferFidu(address(this), address(caller), shares);

    _startImpersonation(address(this), address(this));
    uint256 requestToken = caller.requestWithdrawal(shares);

    assertEq(address(caller), requestTokens.ownerOf(requestToken));
  }
}

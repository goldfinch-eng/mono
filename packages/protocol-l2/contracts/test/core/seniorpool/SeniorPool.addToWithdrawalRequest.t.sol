// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {TestSeniorPoolCaller} from "../../../test/TestSeniorPoolCaller.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";

contract SeniorPoolAddToWithdrawalRequestTest is SeniorPoolBaseTest {
  function testAddToWithdrawalRequestEoaGoListedWorks(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public onlyAllowListed(user) goListed(user) {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.fiduRequested, requestAmountInFidu + addAmountInFidu);
  }

  function testAddToWithdrawalRequestEoaValidUidWorks(
    address user,
    uint256 requestAmount,
    uint256 addAmount,
    uint256 validUid
  ) public onlyAllowListed(user) {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    uniqueIdentity._mintForTest(user, validUid, 1, "");
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.fiduRequested, requestAmountInFidu + addAmountInFidu);
  }

  function testAddToWithdrawalRequestEoaInvalidUidReverts(
    address user,
    uint256 requestAmount,
    uint256 addAmount,
    uint256 invalidUid
  ) public onlyAllowListed(user) {
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    uniqueIdentity._mintForTest(user, 1, 1, "");
    uniqueIdentity._mintForTest(user, invalidUid, 1, "");
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);

    burnUid(user, 1);
    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
  }

  function testAddtoWithdrawalRequestRevertsWhenEoaHasNoUidOrGoList(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public onlyAllowListed(user) {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);

    removeFromGoList(user);
    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
  }

  function testAddToWithdrawalRequestRevertsWhenCallerIsNotTokenOwner(
    address depositor,
    uint256 depositAmount,
    address otherUser
  )
    public
    onlyAllowListed(depositor)
    onlyAllowListed(otherUser)
    goListed(depositor)
    goListed(otherUser)
  {
    vm.assume(depositor != otherUser);
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(depositor);
    fundAddress(depositor, depositAmount);

    depositToSpFrom(depositor, depositAmount);
    uint256 shares = sp.getNumShares(depositAmount);
    uint256 tokenId = requestWithdrawalFrom(depositor, shares);

    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(otherUser, fiduVal(1), tokenId);
  }

  function testAddToWithdrawalRequestWorksWhenOriginIsGoListedAndCallerHasNothing(
    uint256 requestAmount,
    uint256 addAmount
  ) public {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    uint256 depositAmount = requestAmount + addAmount;
    fundAddress(address(caller), depositAmount);

    caller.deposit(depositAmount);
    uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
    caller.addToWithdrawalRequest(sp.getNumShares(addAmount), tokenId);
  }

  /*================================================================================
  Add To Withdrawal Tests
  ================================================================================*/

  function testAddToWithdrawalRequestAddsToFiduRequested(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    addToGoList(user);
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);
    uint256 requestAmountShares = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountShares);
    uint256 addAmountShares = sp.getNumShares(addAmount);
    uint256 spFiduBefore = fidu.balanceOf(address(sp));
    uint256 userFiduBefore = fidu.balanceOf(user);
    addToWithdrawalRequestFrom(user, addAmountShares, tokenId);

    assertEq(fidu.balanceOf(address(sp)), spFiduBefore + addAmountShares);
    assertEq(fidu.balanceOf(user), userFiduBefore - addAmountShares);
    assertEq(sp.epochAt(1).fiduRequested, requestAmountShares + addAmountShares);
    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, requestAmountShares + addAmountShares);
  }

  function testAddToWithdrawalRequestRevertsForNonTokenOwner(
    address user,
    uint256 requestAmount,
    address notTokenOwner
  ) public {
    vm.assume(user != notTokenOwner);
    vm.assume(fuzzHelper.isAllowed(user));
    vm.assume(fuzzHelper.isAllowed(notTokenOwner));
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user);
    addToGoList(notTokenOwner);
    approveTokensMaxAmount(user);
    approveTokensMaxAmount(notTokenOwner);
    fundAddress(user, requestAmount);

    depositToSpFrom(user, requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, sp.getNumShares(requestAmount));
    uint256 addAmount = fiduVal(1);
    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(notTokenOwner, addAmount, tokenId);
  }

  function testAddToWithdrawalRequestRevertsIfAddAmountExceedsFiduBalance(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_100));
    addToGoList(user);

    approveTokensMaxAmount(user);
    fundAddress(user, requestAmount);

    depositToSpFrom(user, requestAmount);
    uint256 requestShares = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestShares);
    uint256 addShares = sp.getNumShares(addAmount);
    vm.expectRevert("SafeERC20: low-level call failed");
    addToWithdrawalRequestFrom(user, addShares, tokenId);
  }

  function testAddToWithdrawalRequestMultipleTimes(
    address user
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    fundAddress(user, usdcVal(500));
    depositToSpFrom(user, usdcVal(500));
    uint256 tokenId = requestWithdrawalFrom(user, fiduVal(200));
    for (uint256 i = 0; i < 3; ++i) {
      addToWithdrawalRequestFrom(user, fiduVal(1), tokenId);
    }
    assertEq(sp.epochAt(1).fiduRequested, fiduVal(203));
    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, fiduVal(203));
  }

  function testFiduAmountsThatWillResultInZeroUsdcReceivedDuringClaimingAreTruncated(
    address caller,
    uint256 depositAmount,
    uint256 dustAmount
  ) public {
    vm.assume(fuzzHelper.isAllowed(caller));
    addToGoList(caller);
    vm.assume(depositAmount <= 100_000_000_000e6);
    vm.assume(depositAmount > 0);
    uint256 withdrawAmountInUsdc = depositAmount - 1;
    vm.assume(sp.getUSDCAmountFromShares(sp.getNumShares(withdrawAmountInUsdc)) > 0);
    dustAmount = bound(dustAmount, 1, 1e12 - 1);

    fundAddress(caller, depositAmount);
    approveTokensMaxAmount(caller);
    depositToSpFrom(caller, depositAmount);

    // We want to withdraw an amount that will have an amount of fidu that can't
    // be converted to a non-zero amount of USDC and so we add a "dust" amount
    // of fidu [1,1e12)
    uint256 amountToWithdraw = sp.usdcToFidu(withdrawAmountInUsdc) + dustAmount;
    uint256 tokenId = requestWithdrawalFrom(caller, amountToWithdraw);

    // go to the next epoch
    uint256 epochEndsAt = sp.currentEpoch().endsAt;
    vm.warp(epochEndsAt);

    // previewed value
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory beforeWr = sp.withdrawalRequest(tokenId);

    // the request should be completely liquidated, so no fidu should be remaining
    assertZero(beforeWr.fiduRequested);
    assertEq(beforeWr.usdcWithdrawable, withdrawAmountInUsdc);

    uint256 amountWithdrawn = claimWithdrawalRequestFrom(caller, tokenId);
    assertEq(
      amountWithdrawn,
      withdrawalAmountLessFees(withdrawAmountInUsdc),
      "withdraw amount incorrect"
    );

    // After claiming when a request is fully liquidated, the token should be burned
    assertZero(requestTokens.balanceOf(caller));
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(tokenId);
  }

  function testAddToWithdrawalRequestLiquidatesIfOneOrMoreEpochsHaveEndedSinceLastCheckpoint(
    address user,
    uint256 epochsElapsed
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    epochsElapsed = bound(epochsElapsed, 1, 10);
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, usdcVal(400));

    depositToSpFrom(user, usdcVal(400));
    uint256 tokenId = requestWithdrawalFrom(user, fiduVal(100));

    // Invest 1/5th of senior pool usdcAvailable to deplete it
    (TranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);

    sp.invest(tp);

    // Put partial liquidty back
    depositToSpFrom(GF_OWNER, usdcVal(50));

    vm.warp(block.timestamp + sp.epochDuration() * epochsElapsed);

    addToWithdrawalRequestFrom(user, fiduVal(200), tokenId);

    ISeniorPoolEpochWithdrawals.Epoch memory liquidatedEpoch = sp.epochAt(1);
    assertEq(liquidatedEpoch.fiduRequested, fiduVal(100));
    assertEq(liquidatedEpoch.fiduLiquidated, fiduVal(50));
    assertEq(liquidatedEpoch.usdcAllocated, usdcVal(50));
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.usdcWithdrawable, usdcVal(50));
    assertEq(request.fiduRequested, fiduVal(250));
  }

  function testAddingToAFullyLiquidatedRequestWorks(address user1, address user2) public {
    // If your request was fully liquidated in epoch i and you add to your request in epoch i + j (j >= 1)
    // Then the added amount should not receive liquidations in epochs i+1, ..., i+j.
    vm.assume(user1 != user2);
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(10_000_000));
    fundAddress(user2, usdcVal(10_000_000));

    // EPOCH 1
    // usdcAvailable = $3600, fiduRequested = 3500
    depositToSpFrom(user1, usdcVal(4000));
    // Invest in a pool to suck up liquidity
    (TranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);
    uint256 token1 = requestWithdrawalFrom(user1, fiduVal(3500));
    depositToSpFrom(user2, usdcVal(3600)); // User 2's deposit allows User 1 to fully liquidate

    // EPOCH 2
    // usdcAvailable = $100 + $500 = 600, fiduRequested = 1000 (all from user2)
    vm.warp(block.timestamp + sp.epochDuration());
    uint256 token2 = requestWithdrawalFrom(user2, fiduVal(1000));
    depositToSpFrom(GF_OWNER, usdcVal(500));

    // EPOCH 3
    vm.warp(block.timestamp + sp.epochDuration());
    // Person2 adding to their withdrawal request should not give them any usdcAllocated from epoch2
    addToWithdrawalRequestFrom(user1, fiduVal(500), token1);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request1 = sp.withdrawalRequest(token1);
    assertEq(request1.usdcWithdrawable, usdcVal(3500));
    assertEq(request1.fiduRequested, fiduVal(500));
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request2 = sp.withdrawalRequest(token2);
    assertEq(request2.usdcWithdrawable, usdcVal(600));
    assertEq(request2.fiduRequested, fiduVal(400));
    assertEq(sp.epochAt(1).fiduRequested, fiduVal(3500));
    assertEq(sp.epochAt(1).usdcAllocated, usdcVal(3500));
    assertEq(sp.epochAt(2).fiduRequested, fiduVal(1000));
    assertEq(sp.epochAt(2).usdcAllocated, usdcVal(600));
  }

  function testAddToWithdrawalEmitsWithdrawalAddedTo(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    addToGoList(user);
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);
    uint256 requestAmountShares = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountShares);
    uint256 addAmountShares = sp.getNumShares(addAmount);
    vm.expectEmit(true, true, true, true, address(sp));
    emit WithdrawalAddedTo(1, 1, user, addAmountShares);
    addToWithdrawalRequestFrom(user, addAmountShares, tokenId);
  }

  function testAddToWithdrawalRequestRevertsWhenOriginHasValidUidAndCallerHasNothing(
    uint256 requestAmount,
    uint256 addAmount,
    uint256 validUid
  ) public {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    approveTokensMaxAmount(address(this));
    uint256 depositAmount = requestAmount + addAmount;
    fundAddress(address(this), depositAmount);
    depositToSpFrom(address(this), depositAmount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    uint256 depositShares = sp.getNumShares(depositAmount);
    fidu.transfer(address(caller), depositShares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
    approveForAll(address(this), address(caller), false);
    uint256 addAmountShares = sp.getNumShares(addAmount);
    vm.expectRevert(bytes("NA"));
    caller.addToWithdrawalRequest(addAmountShares, tokenId);
    _stopImpersonation();
  }

  function testAddToWithdrawalRequestWorksWhenOriginHasValidUidAndCallerIsErc1155Approved(
    uint256 requestAmount,
    uint256 addAmount,
    uint256 validUid
  ) public {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    approveTokensMaxAmount(address(this));
    uint256 depositAmount = requestAmount + addAmount;
    fundAddress(address(this), depositAmount);
    depositToSpFrom(address(this), depositAmount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    uint256 depositShares = sp.getNumShares(depositAmount);
    fidu.transfer(address(caller), depositShares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
    caller.addToWithdrawalRequest(sp.getNumShares(addAmount), tokenId);
    _stopImpersonation();

    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, depositShares);
  }

  function testAddToWithdrawalRevertsWhenOriginHasInvalidUidAndCallerIsErc1155Approved(
    uint256 requestAmount,
    uint256 addAmount,
    uint256 invalidUid
  ) public {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    uniqueIdentity._mintForTest(address(this), invalidUid, 1, "");
    uniqueIdentity._mintForTest(address(this), 1, 1, "");
    approveTokensMaxAmount(address(this));
    uint256 depositAmount = requestAmount + addAmount;
    fundAddress(address(this), depositAmount);
    depositToSpFrom(address(this), depositAmount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    uint256 depositShares = sp.getNumShares(depositAmount);
    fidu.transfer(address(caller), depositShares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
    burnUid(address(this), 1);
    uint256 addAmountShares = sp.getNumShares(addAmount);
    vm.expectRevert(bytes("NA"));
    caller.addToWithdrawalRequest(addAmountShares, tokenId);
  }
}

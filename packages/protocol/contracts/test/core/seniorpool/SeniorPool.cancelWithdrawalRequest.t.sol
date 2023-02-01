// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {TestSeniorPoolCaller} from "../../../test/TestSeniorPoolCaller.sol";
import {TestTranchedPool} from "../../TestTranchedPool.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";

contract SeniorPoolCancelWithdrawalRequestTest is SeniorPoolBaseTest {
  function testCancelWithdrawalRequestEoaGoListedWorks(
    address user,
    uint256 depositAmount
  ) public onlyAllowListed(user) goListed(user) {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    assertEq(requestTokens.balanceOf(user), 1);
    cancelWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testCancelWithdrawalRequestEoaValidUidWorks(
    address user,
    uint256 depositAmount,
    uint256 validUid
  ) public onlyAllowListed(user) {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    uniqueIdentity._mintForTest(user, validUid, 1, "");
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    assertEq(requestTokens.balanceOf(user), 1);
    cancelWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testCancelWithdrawalRequestEoaInvalidUidReverts(
    address user,
    uint256 depositAmount,
    uint256 invalidUid
  ) public onlyAllowListed(user) {
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    uniqueIdentity._mintForTest(user, 1, 1, "");
    uniqueIdentity._mintForTest(user, invalidUid, 1, "");
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    burnUid(user, 1);
    vm.expectRevert(bytes("NA"));
    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestRevertsWhenEoaHasNoUidOrGoList(
    address user,
    uint256 depositAmount
  ) public onlyAllowListed(user) {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);

    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    removeFromGoList(user);
    vm.expectRevert(bytes("NA"));
    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestRevertsWhenCallerIsNotTokenOwner(
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

    uint256 depositShares = depositToSpFrom(depositor, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(depositor, depositShares);

    vm.expectRevert(bytes("NA"));
    cancelWithdrawalRequestFrom(otherUser, tokenId);
  }

  function testCancelWithdrawalRequestWorksWhenOriginIsGoListedAndCallerHasNothing(
    uint256 depositAmount
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    fundAddress(address(caller), depositAmount);

    uint256 depositShares = caller.deposit(depositAmount);
    uint256 tokenId = caller.requestWithdrawal(depositShares);

    assertEq(requestTokens.balanceOf(address(caller)), 1);
    caller.cancelWithdrawalRequest(tokenId);
    assertZero(requestTokens.balanceOf(address(caller)));
  }

  /*================================================================================
  Cancel Withdrawal Request Tests
  ================================================================================*/

  function testCancelWithdrawalRequestBurnsNftWhenUsdcWithdrawableIsZero(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);
    depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(requestTokens.balanceOf(user), tokenId);
    cancelWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testCancelWithdrawalRequestRevertsOnAFullyLiquidatedRequest(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    amount = bound(amount, 1, 100_000_000_000e6);
    fundAddress(user, amount);
    uint256 receivedShares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, receivedShares);

    uint256 epochEndTime = sp.currentEpoch().endsAt;
    vm.warp(epochEndTime);

    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory wr = sp.withdrawalRequest(tokenId);

    assertZero(wr.fiduRequested);
    assertGt(wr.usdcWithdrawable, 0);

    vm.expectRevert("Cant cancel");
    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestCannotBeCalledMoreThanOnce(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    amount = bound(amount, 1e6, 100_000_000e6);
    fundAddress(user, amount);
    uint256 receivedShares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, receivedShares);

    // Invest in a tranched pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    // this should invest half of the users investment
    depositToTpFrom(GF_OWNER, (amount / 2) / 4, tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    uint256 epochEndTime = sp.currentEpoch().endsAt;
    vm.warp(epochEndTime);

    uint256 expectedRemainingShares = receivedShares / 2;
    uint256 expectedCancellationFee = cancelationFee(expectedRemainingShares);
    uint256 expectedReceivedShares = expectedRemainingShares - expectedCancellationFee;
    uint256 sharesFromCancel = cancelWithdrawalRequestFrom(user, tokenId);

    assertApproxEqAbs(sharesFromCancel, expectedReceivedShares, 1e18);

    {
      ISeniorPoolEpochWithdrawals.WithdrawalRequest memory wr = sp.withdrawalRequest(tokenId);
      assertZero(wr.fiduRequested);
    }

    vm.expectRevert("Cant cancel");
    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestDoesntBurnNftWhenUsdcWithdrawableGtZero(
    address user
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(requestTokens.balanceOf(user), tokenId);

    // Invest in a tranched pool to suck up liquidity so that there is
    // _some_ fidu left in the withdraw request so it can be cancelled
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    vm.warp(block.timestamp + sp.epochDuration());

    cancelWithdrawalRequestFrom(user, tokenId);
    assertEq(requestTokens.balanceOf(user), 1);
    assertGt(sp.withdrawalRequest(tokenId).usdcWithdrawable, 0);
  }

  function testCancelWithdrawalRequestEmitsReserveSharesCollected(
    address user
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // Invest in a tranched pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Deposit so the requestor is able to partially liquidate
    depositToSpFrom(GF_OWNER, usdcVal(100));

    vm.warp(block.timestamp + sp.epochDuration());

    uint256 canceledShares = sp.getNumShares(usdcVal(300));
    uint256 treasuryShares = cancelationFee(canceledShares);

    vm.expectEmit(true, true, false, true);
    emit ReserveSharesCollected(user, gfConfig.protocolAdminAddress(), treasuryShares);

    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestEmitsWithdrawalCanceled(
    address user
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // Invest in a tranched pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Deposit so the requestor is able to partially liquidate
    depositToSpFrom(GF_OWNER, usdcVal(100));

    vm.warp(block.timestamp + sp.epochDuration());

    vm.expectEmit(true, true, true, true, address(sp));
    uint256 canceledShares = sp.getNumShares(usdcVal(300));
    uint256 treasuryShares = cancelationFee(canceledShares);
    uint256 userShares = canceledShares - treasuryShares;
    emit WithdrawalCanceled(2, tokenId, user, userShares, treasuryShares);

    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestInAnEpochAfterTheRequestWasMadeWorks(
    address user
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // Invest in a tranched pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Deposit so the requestor is able to partially liquidate
    depositToSpFrom(GF_OWNER, usdcVal(100));

    vm.warp(block.timestamp + sp.epochDuration());

    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, fiduVal(300));
    assertEq(sp.withdrawalRequest(tokenId).usdcWithdrawable, usdcVal(100));

    uint256 userBalanceBefore = fidu.balanceOf(address(user));
    uint256 treasuryBalanceBefore = fidu.balanceOf(address(gfConfig.protocolAdminAddress()));

    cancelWithdrawalRequestFrom(user, tokenId);

    uint256 reserveFidu = cancelationFee(fiduVal(300));
    uint256 userFidu = fiduVal(300) - reserveFidu;
    assertZero(fidu.balanceOf(address(sp)));
    assertEq(fidu.balanceOf(address(user)), userBalanceBefore + userFidu);
    assertEq(fidu.balanceOf(gfConfig.protocolAdminAddress()), treasuryBalanceBefore + reserveFidu);
    assertZero(sp.withdrawalRequest(tokenId).fiduRequested);
    assertEq(sp.withdrawalRequest(tokenId).usdcWithdrawable, usdcVal(100));
    assertEq(requestTokens.balanceOf(user), 1);
    assertZero(sp.epochAt(2).fiduRequested);
  }

  function testCancelWithdrawalRequestInTheSameEpochTheRequestWasMadeWorks(
    address user1,
    address user2,
    uint256 depositAmount1,
    uint256 depositAmount2
  ) public {
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    depositAmount1 = bound(depositAmount1, usdcVal(1), usdcVal(10_000_000));
    depositAmount2 = bound(depositAmount2, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, depositAmount1);
    fundAddress(user2, depositAmount2);

    depositToSpFrom(user1, depositAmount1);
    depositToSpFrom(user2, depositAmount2);
    requestWithdrawalFrom(user1, sp.getNumShares(depositAmount1));
    requestWithdrawalFrom(user2, sp.getNumShares(depositAmount2));

    uint256 spFiduBefore = fidu.balanceOf(address(sp));
    uint256 userBalanceBefore = fidu.balanceOf(address(user1));
    uint256 treasuryBalanceBefore = fidu.balanceOf(address(gfConfig.protocolAdminAddress()));
    ISeniorPoolEpochWithdrawals.Epoch memory epoch = sp.epochAt(1);

    // First user cancels their request
    cancelWithdrawalRequestFrom(user1, 1);
    uint256 reserveFidu = cancelationFee(sp.getNumShares(depositAmount1));
    uint256 userFidu = sp.getNumShares(depositAmount1) - reserveFidu;
    assertEq(fidu.balanceOf(address(sp)), spFiduBefore - (userFidu + reserveFidu));
    assertEq(fidu.balanceOf(address(user1)), userBalanceBefore + userFidu);
    assertEq(fidu.balanceOf(gfConfig.protocolAdminAddress()), treasuryBalanceBefore + reserveFidu);
    assertZero(requestTokens.balanceOf(user1));
    // Epoch 1's fiduRequested should no longer include user 1's fidu
    assertEq(sp.epochAt(1).fiduRequested, epoch.fiduRequested - (userFidu + reserveFidu));
    // Request info is empty
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);

    spFiduBefore = fidu.balanceOf(address(sp));
    userBalanceBefore = fidu.balanceOf(address(user2));
    treasuryBalanceBefore = fidu.balanceOf(address(gfConfig.protocolAdminAddress()));
    epoch = sp.epochAt(1);

    // Second user cancels their request
    cancelWithdrawalRequestFrom(user2, 2);
    reserveFidu = cancelationFee(sp.getNumShares(depositAmount2));
    userFidu = sp.getNumShares(depositAmount2) - reserveFidu;
    assertEq(fidu.balanceOf(address(sp)), spFiduBefore - (userFidu + reserveFidu));
    assertEq(fidu.balanceOf(address(user2)), userBalanceBefore + userFidu);
    assertEq(fidu.balanceOf(gfConfig.protocolAdminAddress()), treasuryBalanceBefore + reserveFidu);
    assertZero(requestTokens.balanceOf(user2));
    // Epoch 1's fiduRequested should be 0
    assertZero(sp.epochAt(1).fiduRequested);
    // Request info is empty
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(2);
  }

  function testCancelWithdrawalRequestRevertsForInvalidBps(
    uint256 bps
  ) public impersonating(GF_OWNER) {
    vm.assume(bps > 10_000);

    gfConfig.setNumber(uint256(ConfigOptions.Numbers.SeniorPoolWithdrawalCancelationFeeInBps), bps);

    uint256 shares = sp.deposit(usdcVal(1));
    uint256 requestId = sp.requestWithdrawal(shares);

    vm.expectRevert("Invalid Bps");
    sp.cancelWithdrawalRequest(requestId);
  }

  function testCancelWithdrawalRequestRevertsWhenOriginHAsValidUidAndCallerHasNothing(
    uint256 depositAmount,
    uint256 validUid
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    approveTokensMaxAmount(address(this));
    fundAddress(address(this), depositAmount);
    uint256 depositShares = depositToSpFrom(address(this), depositAmount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    fidu.transfer(address(caller), depositShares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(depositShares);
    approveForAll(address(this), address(caller), false);
    vm.expectRevert(bytes("NA"));
    caller.cancelWithdrawalRequest(tokenId);
    _stopImpersonation();
  }

  function testCancelWithdrawalRequestWorksWhenOriginHasValidUidAndCallerIsErc1155Approved(
    uint256 depositAmount,
    uint256 validUid
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    approveTokensMaxAmount(address(this));
    fundAddress(address(this), depositAmount);
    uint256 depositShares = depositToSpFrom(address(this), depositAmount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    fidu.transfer(address(caller), depositShares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(depositShares);
    caller.cancelWithdrawalRequest(tokenId);
    _stopImpersonation();

    assertZero(requestTokens.balanceOf(address(caller)));
  }

  function testCancelWithdrawalRevertsWhenOriginHasInvalidUidAndCallerIsErc1155Approved(
    uint256 depositAmount,
    uint256 invalidUid
  ) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    uniqueIdentity._mintForTest(address(this), invalidUid, 1, "");
    uniqueIdentity._mintForTest(address(this), 1, 1, "");
    approveTokensMaxAmount(address(this));
    fundAddress(address(this), depositAmount);
    uint256 depositShares = depositToSpFrom(address(this), depositAmount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    fidu.transfer(address(caller), depositShares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(depositAmount));
    burnUid(address(this), 1);
    vm.expectRevert(bytes("NA"));
    caller.cancelWithdrawalRequest(tokenId);
  }
}

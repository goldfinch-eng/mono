// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {TestSeniorPoolCaller} from "../../../test/TestSeniorPoolCaller.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";

contract SeniorPoolClaimWithdrawalRequestTest is SeniorPoolBaseTest {
  function testClaimWithdrawalEoaWorksGoListed(address user) public {
    vm.assume(fuzzHelper.isAllowed(user));
    approveTokensMaxAmount(user);
    addToGoList(user);
    fundAddress(user, usdcVal(4000));

    uint256 shares = depositToSpFrom(user, usdcVal(4000));

    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    claimWithdrawalRequestFrom(user, tokenId);
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
  }

  function testClaimWithdrawalEoaWorksWithValidUid(address user, uint256 uidType) public {
    vm.assume(fuzzHelper.isAllowed(user));
    uidType = bound(uidType, 1, 4);
    vm.assume(uidType != 2);

    approveTokensMaxAmount(user);
    uniqueIdentity._mintForTest(user, uidType, 1, "");
    assertEq(uniqueIdentity.balanceOf(user, uidType), 1);
    fundAddress(user, usdcVal(4000));

    uint256 shares = depositToSpFrom(user, usdcVal(4000));
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    claimWithdrawalRequestFrom(user, tokenId);
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
  }

  function testClaimWithdrawalRevertsForInvalidUid(
    address user,
    uint256 invalidUidType
  ) public onlyAllowListed(user) {
    invalidUidType = bound(invalidUidType, 5, type(uint256).max);
    approveTokensMaxAmount(user);
    uniqueIdentity._mintForTest(user, 1, 1, "");
    fundAddress(user, usdcVal(4000));

    uint256 shares = depositToSpFrom(user, usdcVal(4000));
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    burnUid(user, 1);
    uniqueIdentity._mintForTest(user, invalidUidType, 1, "");

    vm.expectRevert(bytes("NA"));
    claimWithdrawalRequestFrom(user, tokenId);
  }

  function testClaimWithdrawalRevertsForNoUidAndNoGoList(
    address user
  ) public onlyAllowListed(user) {
    approveTokensMaxAmount(user);
    uniqueIdentity._mintForTest(user, 1, 1, "");
    fundAddress(user, usdcVal(4000));
    uint256 shares = depositToSpFrom(user, usdcVal(4000));
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    burnUid(user, 1);

    vm.expectRevert(bytes("NA"));
    claimWithdrawalRequestFrom(user, tokenId);
  }

  function testClaimWithdrawalWorksWhenOriginHasNothingAndCallerIsGoListed() public {
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    fundAddress(address(caller), usdcVal(4000));
    caller.deposit(usdcVal(4000));
    uint256 shares = sp.getNumShares(usdcVal(4000));
    uint256 tokenId = caller.requestWithdrawal(shares);

    vm.warp(block.timestamp + sp.epochDuration());

    caller.claimWithdrawalRequest(tokenId);
    assertZero(requestTokens.balanceOf(address(caller)));
  }

  /*================================================================================
  Claim Withdrawal Request Tests
  ================================================================================*/

  function testClaimWithdrawalRequestNoOpsOnEarlyWithdrawal(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    uint256 userUsdcBefore = usdc.balanceOf(user);
    uint256 spUsdcBefore = usdc.balanceOf(address(sp));
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);

    claimWithdrawalRequestFrom(user, tokenId);

    assertEq(usdc.balanceOf(user), userUsdcBefore);
    assertEq(usdc.balanceOf(address(sp)), spUsdcBefore);
    assertEq(sp.withdrawalRequest(tokenId).epochCursor, request.epochCursor);
    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, request.fiduRequested);
    assertEq(sp.withdrawalRequest(tokenId).usdcWithdrawable, request.usdcWithdrawable);
  }

  function testClaimWithdrawalRequestBurnsNftWhenAllFiduIsLiquidated(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // No usdc outflows, so request will be fully liquidated by the next epoch
    vm.warp(block.timestamp + sp.epochDuration());

    assertEq(requestTokens.balanceOf(user), 1);
    claimWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testClaimWithdrawalRequestWithdrawsUpToTheCurrentEpoch(
    address user1,
    address user2
  ) public {
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    // Use a TP to suck up all liquidity
    (TranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Epoch 1
    depositToSpFrom(GF_OWNER, usdcVal(500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 2
    depositToSpFrom(GF_OWNER, usdcVal(350));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 3
    depositToSpFrom(GF_OWNER, usdcVal(1000));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 4
    // In Epoch 1 we had $500 in and $4000 requested, so 12.5% fulfilled
    // In Epoch 2 we had $350 in and $3500 requested, so 10% fulfilled
    // In Epoch 3 we had $1000 in and $3150 requested, so 31.746031746% fulfilled
    uint256 usdcEpoch1 = (usdcVal(1000) * 125) / 1000;
    uint256 fiduEpoch1 = (fiduVal(1000) * 125) / 1000;
    uint256 usdcEpoch2 = (usdcVal(1000) - usdcEpoch1) / 10;
    uint256 fiduEpoch2 = (fiduVal(1000) - fiduEpoch1) / 10;
    uint256 usdcEpoch3 = ((usdcVal(1000) - usdcEpoch2 - usdcEpoch1) * 31_746_031_746) /
      100_000_000_000;
    uint256 fiduEpoch3 = ((fiduVal(1000) - fiduEpoch2 - fiduEpoch1) * 31_746_031_746) /
      100_000_000_000;
    uint256 usdcWithdrawable = usdcEpoch1 + usdcEpoch2 + usdcEpoch3;
    uint256 fiduLiquidated = fiduEpoch1 + fiduEpoch2 + fiduEpoch3;
    uint256 userUsdcBefore = usdc.balanceOf(address(user1));

    claimWithdrawalRequestFrom(user1, 1);

    assertApproxEqAbs(
      usdc.balanceOf(address(sp)),
      usdcVal(1850) - usdcWithdrawable,
      thresholdUsdc()
    );
    assertApproxEqAbs(usdc.balanceOf(TREASURY), withdrawalFee(usdcWithdrawable), thresholdUsdc());
    assertEq(usdc.balanceOf(user1), userUsdcBefore + withdrawalAmountLessFees(usdcWithdrawable));
    assertApproxEqAbs(
      sp.withdrawalRequest(1).fiduRequested,
      fiduVal(1000) - fiduLiquidated,
      thresholdFidu()
    );
    assertZero(sp.withdrawalRequest(1).usdcWithdrawable);
    assertEq(sp.withdrawalRequest(1).epochCursor, 4);

    usdcEpoch1 = (usdcVal(3000) * 125) / 1000;
    fiduEpoch1 = (fiduVal(3000) * 125) / 1000;
    usdcEpoch2 = (usdcVal(3000) - usdcEpoch1) / 10;
    fiduEpoch2 = (fiduVal(3000) - fiduEpoch1) / 10;
    usdcEpoch3 = ((usdcVal(3000) - usdcEpoch2 - usdcEpoch1) * 31_746_031_746) / 100_000_000_000;
    fiduEpoch3 = ((fiduVal(3000) - fiduEpoch2 - fiduEpoch1) * 31_746_031_746) / 100_000_000_000;
    usdcWithdrawable = usdcEpoch1 + usdcEpoch2 + usdcEpoch3;
    fiduLiquidated = fiduEpoch1 + fiduEpoch2 + fiduEpoch3;
    userUsdcBefore = usdc.balanceOf(address(user2));

    {
      uint256 spUsdcBefore = usdc.balanceOf(address(sp));
      uint256 treasuryUsdcBefore = usdc.balanceOf(address(TREASURY));
      claimWithdrawalRequestFrom(user2, 2);

      assertApproxEqAbs(
        usdc.balanceOf(address(sp)),
        spUsdcBefore - usdcWithdrawable,
        thresholdUsdc()
      );
      assertApproxEqAbs(
        usdc.balanceOf(TREASURY),
        treasuryUsdcBefore + withdrawalFee(usdcWithdrawable),
        thresholdUsdc()
      );
      assertEq(usdc.balanceOf(user2), userUsdcBefore + withdrawalAmountLessFees(usdcWithdrawable));
      assertApproxEqAbs(
        sp.withdrawalRequest(2).fiduRequested,
        fiduVal(3000) - fiduLiquidated,
        thresholdFidu()
      );
      assertZero(sp.withdrawalRequest(2).usdcWithdrawable);
      assertEq(sp.withdrawalRequest(2).epochCursor, 4);
    }
  }

  function testClaimWithdrawalShouldClearMyPositionWhenClearingInThePast(
    address user1,
    address user2
  ) public {
    (TranchedPool tp, ) = defaultTp();
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    // Use a TP to suck up all liquidity
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Epoch 1
    depositToSpFrom(GF_OWNER, usdcVal(500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 2
    depositToSpFrom(GF_OWNER, usdcVal(1500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 3
    depositToSpFrom(GF_OWNER, usdcVal(2500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 4
    // This deposit will fully liquidate requests
    depositToSpFrom(GF_OWNER, usdcVal(10_000));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 5
    claimWithdrawalRequestFrom(user1, 1);
    claimWithdrawalRequestFrom(user2, 2);

    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(2);
    assertZero(requestTokens.balanceOf(user1));
    assertZero(requestTokens.balanceOf(user2));

    assertEq(usdc.balanceOf(user1), withdrawalAmountLessFees(usdcVal(1000)));
    assertEq(usdc.balanceOf(user2), withdrawalAmountLessFees(usdcVal(3000)));
    assertEq(usdc.balanceOf(TREASURY), withdrawalFee(usdcVal(4000)));

    assertEq(sp.usdcAvailable(), usdcVal(10_500));
  }

  function testClaimWithdrawalClearsMyPositionWhenThereIsEnoughLiquidity(
    address user,
    uint256 amount
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, amount);

    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    claimWithdrawalRequestFrom(user, tokenId);

    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
    assertZero(requestTokens.balanceOf(user));
  }

  function testClaimWithdrawalUsesTheSharePriceFromEachEpochToDetermineFiduLiquidated(
    address user1,
    address user2
  ) public {
    vm.warp(1672513372); // December 31st. Minimize the stub period

    (TranchedPool tp, CreditLine cl) = defaultTp();
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    // Use a TP to suck up all liquidity
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    uint256 poolToken = sp.invest(tp);

    drawdownTp(usdcVal(5000), tp);

    // $500 deposit in epoch 1, share price = 1.00
    depositToSpFrom(GF_OWNER, usdcVal(500));

    // Epoch 3, when first tp payment is due. Pay and redeem
    vm.warp(block.timestamp + 32 days);
    tp.assess();
    payTp(cl.interestOwed(), tp);
    // Make a deposit such that inflows for this epoch total $200
    depositToSpFrom(GF_OWNER, usdcVal(200) - poolTokens.getTokenInfo(poolToken).interestRedeemed);

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 4
    // Epoch 1
    //    sharePrice = 1000000000000000000
    //    usdcIn = $500
    //    epochFidu = 4000
    //    user1TotalFidu = 1000
    //    user1Usdc = $500 * 1000/4000 = $125
    //    user1Fidu = $125/1.00 = 125
    // Epoch 2 0 inflows
    // Epoch 3
    //    sharePrice = 1002876712250000000
    //    usdcIn = $200
    //    epochFidu = 3500
    //    user1TotalFidu = 875
    //    user1Usdc = $200 * 875/3500 = $50
    //    user1Fidu = $50/1.002876712250000000 = $49.856576974275036
    uint256 usdcEpoch1 = usdcVal(125);
    uint256 usdcEpoch3 = usdcVal(50);
    uint256 usdcWithdrawable = usdcEpoch1 + usdcEpoch3;
    uint256 fiduEpoch1 = fiduVal(125);
    uint256 fiduEpoch3 = sp.__getNumShares(usdcVal(50), sp.sharePrice());
    uint256 fiduLiquidated = fiduEpoch1 + fiduEpoch3;

    assertEq(sp.withdrawalRequest(1).usdcWithdrawable, usdcWithdrawable);

    claimWithdrawalRequestFrom(user1, 1);

    assertEq(usdc.balanceOf(user1), withdrawalAmountLessFees(usdcWithdrawable));
    assertEq(sp.withdrawalRequest(1).fiduRequested, fiduVal(1000) - fiduLiquidated);
    assertZero(sp.withdrawalRequest(1).usdcWithdrawable);

    usdcEpoch1 = usdcVal(375);
    usdcEpoch3 = usdcVal(150);
    usdcWithdrawable = usdcEpoch1 + usdcEpoch3;
    fiduEpoch1 = fiduVal(375);
    fiduEpoch3 = sp.__getNumShares(usdcVal(150), sp.sharePrice());
    fiduLiquidated = fiduEpoch1 + fiduEpoch3;

    assertEq(sp.withdrawalRequest(2).usdcWithdrawable, usdcWithdrawable);

    claimWithdrawalRequestFrom(user2, 2);

    assertEq(usdc.balanceOf(user2), withdrawalAmountLessFees(usdcWithdrawable));
    assertEq(sp.withdrawalRequest(2).fiduRequested, fiduVal(3000) - fiduLiquidated);
    assertZero(sp.withdrawalRequest(2).usdcWithdrawable);
  }

  /**
    This function simulates a user waiting many epochs before claiming their request. We want to make sure
    that claiming is not prohibitively expensive, even if they wait a long time.
   */
  function testClaimWithdrawalRequestAfterLongTimeIsNotTooExpensive(
    address user1,
    address user2
  ) public {
    vm.warp(1672513372); // December 31st. Minimize the stub period

    (TranchedPool tp, CreditLine cl) = defaultTp();
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    uint256 token1 = requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    drawdownTp(usdcVal(5000), tp);

    // EPOCH 1 - senior pool deposit
    depositToSpFrom(GF_OWNER, usdcVal(1000));

    // EPOCH 2 - senior pool deposit
    vm.warp(block.timestamp + 14 days);
    depositToSpFrom(GF_OWNER, usdcVal(1000));

    // EPOCH 3 - tranched pool repayment
    vm.warp(block.timestamp + 18 days);
    assertTrue(cl.interestOwed() > 0);
    payTp(cl.interestOwed(), tp);
    assertZero(cl.interestOwed());

    // EPOCH 4 - senior pool deposit
    vm.warp(block.timestamp + 14 days);
    depositToSpFrom(GF_OWNER, usdcVal(500));

    // EPOCH 5 - tranched pool repayment
    vm.warp(block.timestamp + 18 days);
    assertTrue(cl.interestOwed() > 0, "Has interest owed");
    payTp(cl.interestOwed(), tp);
    assertZero(cl.interestOwed(), "No more interest owed");

    // EPOCH 6 - claim withdrawal request
    vm.warp(block.timestamp + 14 days);
    // small deposit to trigger epoch checkpoint
    depositToSpFrom(GF_OWNER, usdcVal(1));

    uint256 gasBeforeClaim = gasleft();
    claimWithdrawalRequestFrom(user1, token1);
    uint256 gasUsedApprox = gasBeforeClaim - gasleft();

    // Assert gasUsed is under the actual gas used plus a decent amount of wriggle room.
    // Exceeding the limit indicates a siginifacnt gas addition
    assertTrue(gasUsedApprox < 200_000);
  }

  function testClaimWithdrawalFailsWhenCallerIsErc1155ApprovedForInvalidUid(
    uint256 invalidUid
  ) public {
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    uniqueIdentity._mintForTest(address(this), 1, 1, "");
    fundAddress(address(this), usdcVal(4000));
    approveTokensMaxAmount(address(this));
    uint256 shares = depositToSpFrom(address(this), usdcVal(4000));

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    transferFidu(address(this), address(caller), shares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(shares);
    _stopImpersonation();

    vm.warp(block.timestamp + sp.epochDuration());

    burnUid(address(this), 1);
    uniqueIdentity._mintForTest(address(this), invalidUid, 1, "");

    _startImpersonation(address(this), address(this));
    vm.expectRevert(bytes("NA"));
    caller.claimWithdrawalRequest(tokenId);
    _stopImpersonation();
  }

  function testClaimWithdrawalFailsWhenOriginHasValidUidButCallerHasNothing(
    uint256 validUid
  ) public {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    approveTokensMaxAmount(address(this));
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    fundAddress(address(this), usdcVal(4000));
    uint256 shares = depositToSpFrom(address(this), usdcVal(4000));

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    transferFidu(address(this), address(caller), shares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(shares);
    _stopImpersonation();

    vm.warp(block.timestamp + sp.epochDuration());

    approveForAll(address(this), address(caller), false);
    _startImpersonation(address(this), address(this));
    vm.expectRevert(bytes("NA"));
    caller.claimWithdrawalRequest(tokenId);
  }

  function testClaimWithdrawalSucceedsWhenCallerIsErc1155ApprovedForValidUid(
    uint256 validUid
  ) public {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    approveTokensMaxAmount(address(this));
    uniqueIdentity._mintForTest(address(this), validUid, 1, "");
    fundAddress(address(this), usdcVal(4000));
    uint256 shares = depositToSpFrom(address(this), usdcVal(4000));

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    transferFidu(address(this), address(caller), shares);

    _startImpersonation(address(this), address(this));
    uint256 tokenId = caller.requestWithdrawal(shares);
    _stopImpersonation();

    vm.warp(block.timestamp + sp.epochDuration());

    _startImpersonation(address(this), address(this));
    caller.claimWithdrawalRequest(tokenId);
    _stopImpersonation();

    assertZero(requestTokens.balanceOf(address(caller)));
  }
}

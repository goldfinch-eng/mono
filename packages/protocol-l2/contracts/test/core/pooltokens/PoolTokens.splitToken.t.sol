// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

contract PoolTokensSplitTokenTest is PoolTokensBaseTest {
  TranchedPool private tp;
  CreditLine private cl;
  uint256 private tokenId;
  IPoolTokens.TokenInfo private tokenInfo;

  // TODO - add more tests for splitting before a pool is locked, as per PR comment
  // https://github.com/warbler-labs/mono/pull/1363#discussion_r1080775940

  // TODO - add a TokenSplit event to make it easier to track token splitting on the subgraph
  // https://github.com/warbler-labs/mono/pull/1363#discussion_r1080778918

  function setUp() public override {
    super.setUp();

    _startImpersonation(GF_OWNER);

    gfConfig.addToGoList(GF_OWNER);

    _stopImpersonation();

    // Advance 1 day to let some staking rewards accumulate
    vm.warp(block.timestamp + 1 days);

    (tp, cl) = defaultTp();
    // Make a junior deposit
    fundAddress(address(this), usdcVal(10_000));
    usdc.approve(address(tp), type(uint256).max);
    tokenId = tp.deposit(2, usdcVal(5));
    tokenInfo = poolTokens.getTokenInfo(tokenId);

    _startImpersonation(GF_OWNER);
    tp.grantRole(TestConstants.SENIOR_ROLE, address(this));
    tp.grantRole(TestConstants.SENIOR_ROLE, GF_OWNER);
    _stopImpersonation();
  }

  function testRevertsForNonOwnerNonApprovedOperator(address caller) public impersonating(caller) {
    vm.assume(fuzzHelper.isAllowed(caller));
    vm.expectRevert(bytes("NA"));
    poolTokens.splitToken(tokenId, usdcVal(5) / 2);
  }

  function testDoesntRevertForOwner() public {
    poolTokens.splitToken(tokenId, usdcVal(1));
  }

  function testDoesntRevertForApprovedOperator(address operator) public {
    vm.assume(operator != address(this));
    poolTokens.setApprovalForAll(operator, true);
    _startImpersonation(operator);
    poolTokens.splitToken(tokenId, usdcVal(1));
  }

  function testRevertsIfAmountsExceedPrincipalAmount(uint256 principal1) public {
    vm.assume(principal1 > tokenInfo.principalAmount);
    vm.expectRevert(bytes("IA"));
    poolTokens.splitToken(tokenId, principal1);
  }

  function testRevertsIfAmountisZero() public {
    vm.expectRevert(bytes("IA"));
    poolTokens.splitToken(tokenId, 0);
  }

  function testEmitsTokenMintedEvents() public {
    // First mint
    vm.expectEmit(true, true, true, true);
    emit TokenMinted({
      owner: address(this),
      pool: address(tp),
      tokenId: tokenId + 1,
      amount: usdcVal(1),
      tranche: 2
    });
    // Second mint
    vm.expectEmit(true, true, true, true);
    emit TokenMinted({
      owner: address(this),
      pool: address(tp),
      tokenId: tokenId + 2,
      amount: usdcVal(4),
      tranche: 2
    });

    poolTokens.splitToken(tokenId, usdcVal(1));
  }

  function testEmitsTransferEvents() public {
    // Burn
    vm.expectEmit(true, true, true, false);
    emit Transfer({_from: address(this), _to: address(0), _tokenId: tokenId});
    // First mint
    vm.expectEmit(true, true, true, false);
    emit Transfer({_from: address(0), _to: address(this), _tokenId: tokenId + 1});
    // Second mint
    vm.expectEmit(true, true, true, false);
    emit Transfer({_from: address(0), _to: address(this), _tokenId: tokenId + 2});

    poolTokens.splitToken(tokenId, usdcVal(1));
  }

  function testEmitsTokenBurnedEvents() public {
    vm.expectEmit(true, true, true, false);
    emit TokenBurned({owner: address(this), pool: address(tp), tokenId: tokenId});

    poolTokens.splitToken(tokenId, usdcVal(1));
  }

  function testEmitsTokenSplitEvent(uint256 principal1) public {
    vm.assume(principal1 > 0 && principal1 < tokenInfo.principalAmount);
    vm.expectEmit(true, true, true, true);
    emit TokenSplit({
      owner: address(this),
      pool: tokenInfo.pool,
      tokenId: tokenId,
      newTokenId1: 2,
      newPrincipal1: principal1,
      newTokenId2: 3,
      newPrincipal2: tokenInfo.principalAmount - principal1
    });
    poolTokens.splitToken(tokenId, principal1);
  }

  function testCanSplitBeforePoolIsLocked() public {
    uint256 halfPrincipal = tokenInfo.principalAmount / 2;
    // Call should succeed
    (uint256 tokenId1, ) = poolTokens.splitToken(tokenId, halfPrincipal);

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    _stopImpersonation();

    uint256 quarterPrincipal = halfPrincipal / 2;
    // Call should succeed
    poolTokens.splitToken(tokenId1, quarterPrincipal);
  }

  function testSplitsPrincipalAmountAccordingToAmounts(uint256 principal1) public {
    principal1 = bound(principal1, 1, tokenInfo.principalAmount - 1);

    (uint256 tokenId1, uint256 tokenId2) = poolTokens.splitToken(tokenId, principal1);

    assertEq(poolTokens.getTokenInfo(tokenId1).principalAmount, principal1);
    assertEq(
      poolTokens.getTokenInfo(tokenId2).principalAmount,
      tokenInfo.principalAmount - principal1
    );
  }

  function testPoolInfoDoesntChange(uint256 principal1) public {
    principal1 = bound(principal1, 1, tokenInfo.principalAmount - 1);

    IPoolTokens.PoolInfo memory poolInfoBefore = poolTokens.getPoolInfo(address(tp));
    poolTokens.splitToken(tokenId, principal1);
    IPoolTokens.PoolInfo memory poolInfoAfter = poolTokens.getPoolInfo(address(tp));

    assertEq(poolInfoBefore.totalMinted, poolInfoAfter.totalMinted);
    assertEq(poolInfoBefore.totalPrincipalRedeemed, poolInfoAfter.totalPrincipalRedeemed);
    assertEq(poolInfoBefore.created, poolInfoAfter.created);
  }

  function testSplitsPrincipalRedeemedProportionally(uint256 principal1) public {
    principal1 = bound(principal1, 1, tokenInfo.principalAmount - 1);

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(20));
    tp.deposit(1, usdcVal(20));
    tp.drawdown(usdcVal(25));
    _stopImpersonation();

    vm.warp(cl.termEndTime());
    tp.assess();
    uint256 interestOwed = cl.interestOwed();
    // Pay 90% of all principal owed which, for the current leverage ratio, will make HALF of the
    // junior token's original principal redeemable. Having principalRedeemed != principalAmount
    // makes for a more robust test when checking that principalRedeemed amounts are correct on
    // split
    uint256 principalOwed = (cl.principalOwed() * 9) / 10;
    usdc.approve(address(tp), interestOwed + principalOwed);
    tp.pay(interestOwed + principalOwed);

    tp.withdrawMax(tokenId);
    IPoolTokens.TokenInfo memory tokenInfoBeforeSplit = poolTokens.getTokenInfo(tokenId);

    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(tokenId, principal1);

    assertEq(
      poolTokens.getTokenInfo(newToken1).principalRedeemed,
      (tokenInfoBeforeSplit.principalRedeemed * principal1) / tokenInfo.principalAmount,
      "First principal redeemed should be proportional to principal1"
    );

    assertEq(
      poolTokens.getTokenInfo(newToken2).principalRedeemed,
      tokenInfoBeforeSplit.principalRedeemed -
        (tokenInfoBeforeSplit.principalRedeemed * principal1) /
        tokenInfo.principalAmount,
      "Second principal redeemed should be proportional to principal1"
    );

    assertEq(
      poolTokens.getTokenInfo(newToken1).principalRedeemed +
        poolTokens.getTokenInfo(newToken2).principalRedeemed,
      tokenInfoBeforeSplit.principalRedeemed,
      "Both should add up to original"
    );
  }

  function testSplitsInterestRedeemedProportionally(uint256 principal1) public {
    principal1 = bound(principal1, usdcVal(1), tokenInfo.principalAmount - usdcVal(1));

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(20));
    tp.deposit(1, usdcVal(20));
    tp.drawdown(usdcVal(25));
    _stopImpersonation();

    vm.warp(cl.nextDueTime() + 1);
    tp.assess();
    tp.pay(cl.interestOwed());
    assertZero(cl.interestOwed());

    tp.withdrawMax(tokenId);
    IPoolTokens.TokenInfo memory tokenInfoBeforeSplit = poolTokens.getTokenInfo(tokenId);

    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(tokenId, principal1);

    assertEq(
      poolTokens.getTokenInfo(newToken1).interestRedeemed,
      (tokenInfoBeforeSplit.interestRedeemed * principal1) / tokenInfo.principalAmount,
      "First interest redeemed should be proportional to principal1"
    );

    assertEq(
      poolTokens.getTokenInfo(newToken2).interestRedeemed,
      tokenInfoBeforeSplit.interestRedeemed -
        (tokenInfoBeforeSplit.interestRedeemed * principal1) /
        tokenInfo.principalAmount,
      "Second interest redeemed should be proportional to principal1"
    );

    assertEq(
      poolTokens.getTokenInfo(newToken1).interestRedeemed +
        poolTokens.getTokenInfo(newToken2).interestRedeemed,
      tokenInfoBeforeSplit.interestRedeemed,
      "Both should add up to original"
    );
  }

  function testOwnerOfNewTokensIsOwnerOfOriginalToken() public {
    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(
      tokenId,
      tokenInfo.principalAmount / 2
    );
    assertEq(poolTokens.ownerOf(newToken1), address(this));
    assertEq(poolTokens.ownerOf(newToken2), address(this));
  }

  function testBurnsOriginalTokenAndDeletesItsData() public {
    // Drawdown, pay back, and redeem so that tokenInfo is non-zero values
    // We want to assert that they're ALL reset back to 0
    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(20));
    tp.deposit(1, usdcVal(20));
    vm.warp(block.timestamp + 100);
    tp.drawdown(usdcVal(25));
    _stopImpersonation();

    vm.warp(cl.termEndTime() + 1);
    tp.assess();
    uint256 totalOwed = cl.interestOwed() + cl.principalOwed();
    tp.pay(totalOwed);

    tp.withdrawMax(tokenId);

    tokenInfo = poolTokens.getTokenInfo(tokenId);
    assertGt(tokenInfo.principalRedeemed, 0);
    assertGt(tokenInfo.interestRedeemed, 0);

    poolTokens.splitToken(tokenId, tokenInfo.principalAmount / 2);
    // Token no longer exists
    vm.expectRevert("ERC721: invalid token ID");
    poolTokens.ownerOf(tokenId);

    // Token info is deleted
    tokenInfo = poolTokens.getTokenInfo(tokenId);
    assertEq(tokenInfo.pool, address(0));
    assertZero(tokenInfo.tranche);
    assertZero(tokenInfo.principalAmount);
    assertZero(tokenInfo.interestRedeemed);
    assertZero(tokenInfo.principalRedeemed);
  }

  function testFutureInterestAndPrincipalRedeemableIsSame() public {
    // We do another junior investment EQUAL to the first. We'll split the first junior investment but not split
    // the second. We can compare them against each other to show that at the end of the day you get the same
    // interest and principal out of a split vs non-split token.
    uint256 tokenId2 = tp.deposit(2, usdcVal(5));

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(40));
    tp.deposit(1, usdcVal(40));
    tp.drawdown(usdcVal(50));
    _stopImpersonation();

    vm.warp(cl.nextDueTime() + 1);
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed() + usdcVal(1));
    tp.pay(cl.interestOwed() + usdcVal(1));

    tp.withdrawMax(tokenId2);

    uint256 principal1 = tokenInfo.principalAmount / 8;
    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(tokenId, principal1);

    vm.warp(cl.termEndTime());
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed() + cl.principalOwed());
    tp.pay(cl.interestOwed() + cl.principalOwed());

    IPoolTokens.TokenInfo memory newTokenInfo1 = poolTokens.getTokenInfo(newToken1);
    IPoolTokens.TokenInfo memory newTokenInfo2 = poolTokens.getTokenInfo(newToken2);
    IPoolTokens.TokenInfo memory tokenInfoJunior2 = poolTokens.getTokenInfo(tokenId2);

    (uint256 newToken1WithdrawableInterest, uint256 newToken1WithdrawablePrincipal) = tp
      .availableToWithdraw(newToken1);
    (uint256 newToken2WithdrawableInterest, uint256 newToken2WithdrawablePrincipal) = tp
      .availableToWithdraw(newToken2);
    (uint256 junior2WithdrawableInterest, uint256 junior2WithdrawablePrincipal) = tp
      .availableToWithdraw(tokenId2);

    {
      uint256 newToken1TotalInterest = newToken1WithdrawableInterest +
        newTokenInfo1.interestRedeemed;
      uint256 newToken2TotalInterest = newToken2WithdrawableInterest +
        newTokenInfo2.interestRedeemed;
      uint256 junior2TotalInterest = junior2WithdrawableInterest +
        tokenInfoJunior2.interestRedeemed;
      assertApproxEqAbs(
        newToken1TotalInterest + newToken2TotalInterest,
        junior2TotalInterest,
        usdcVal(1) / 100 / 2, // Half cent tolerance
        "total interest should be the same (within tolerance)"
      );
    }

    {
      uint256 newToken1TotalPrincipal = newToken1WithdrawablePrincipal +
        newTokenInfo1.principalRedeemed;
      uint256 newToken2TotalPrincipal = newToken2WithdrawablePrincipal +
        newTokenInfo2.principalRedeemed;
      uint256 junior2TotalPrincipal = junior2WithdrawablePrincipal +
        tokenInfoJunior2.principalRedeemed;
      assertEq(
        newToken1TotalPrincipal + newToken2TotalPrincipal,
        junior2TotalPrincipal,
        "total principal should be the same"
      );
    }
  }

  function testWorksWhenPoolPaused() public {
    _startImpersonation(GF_OWNER);
    tp.pause();
    assertTrue(tp.paused());
    _stopImpersonation();
    // Call shouldn't revert
    poolTokens.splitToken(tokenId, usdcVal(4));
  }

  event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);

  event TokenMinted(
    address indexed owner,
    address indexed pool,
    uint256 indexed tokenId,
    uint256 amount,
    uint256 tranche
  );

  event TokenBurned(address indexed owner, address indexed pool, uint256 indexed tokenId);

  event TokenSplit(
    address indexed owner,
    address indexed pool,
    uint256 indexed tokenId,
    uint256 newTokenId1,
    uint256 newPrincipal1,
    uint256 newTokenId2,
    uint256 newPrincipal2
  );
}

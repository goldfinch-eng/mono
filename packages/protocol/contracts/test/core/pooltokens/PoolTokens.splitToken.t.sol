// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {TestTranchedPool} from "../../TestTranchedPool.sol";
import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {IBackerRewards} from "../../../interfaces/IBackerRewards.sol";

contract PoolTokensSplitTokenTest is PoolTokensBaseTest {
  TestTranchedPool private tp;
  CreditLine private cl;
  uint256 private tokenId;
  IPoolTokens.TokenInfo private tokenInfo;

  // TODO - add more tests for splitting before a pool is locked, as per PR comment
  // https://github.com/warbler-labs/mono/pull/1363#discussion_r1080775940

  // TODO - add a TokenSplit event to make it easier to track token splitting on the subgraph
  // https://github.com/warbler-labs/mono/pull/1363#discussion_r1080778918

  function setUp() public override {
    super.setUp();

    // Setup backer rewards
    uint256 totalGFISupply = 100_000_000;
    uint256 totalRewards = 1_000;
    uint256 totalStakingRewards = totalGFISupply / 2;
    uint256 totalBackerRewards = totalGFISupply / 2;
    uint256 maxInterestDollarsEligible = 1_000_000_000;

    _startImpersonation(GF_OWNER);

    gfConfig.addToGoList(GF_OWNER);

    gfi.setCap(bigVal(totalGFISupply));
    gfi.mint(GF_OWNER, bigVal(totalGFISupply));
    gfi.approve(GF_OWNER, bigVal(totalGFISupply));

    backerRewards.setMaxInterestDollarsEligible(bigVal(maxInterestDollarsEligible));
    backerRewards.setTotalRewards(bigVal(totalRewards * 100) / 100);
    backerRewards.setTotalInterestReceived(0);

    // Transfer GFI to Backer rewards contract
    gfi.approve(address(backerRewards), bigVal(totalBackerRewards));
    gfi.transfer(address(backerRewards), bigVal(totalBackerRewards));

    // Configure the StakingRewards contract such that the current earn rate is non-zero.
    stakingRewards.setRewardsParameters({
      _targetCapacity: bigVal(1000),
      _minRate: bigVal(1) / 100,
      _maxRate: bigVal(2) * 100,
      _minRateAtPercent: 3 * 1e18,
      _maxRateAtPercent: 5 * 1e17
    });

    gfi.approve(address(stakingRewards), bigVal(totalStakingRewards));
    stakingRewards.loadRewards(bigVal(totalStakingRewards));

    usdc.approve(address(stakingRewards), usdcVal(1000));
    stakingRewards.depositAndStake(usdcVal(1000));

    _stopImpersonation();

    // Advance 1 day to let some staking rewards accumulate
    vm.warp(block.timestamp + 1 days);

    (tp, cl) = defaultTp();
    // Make a junior deposit
    fundAddress(address(this), usdcVal(10_000));
    usdc.approve(address(tp), uint256(-1));
    tokenId = tp.deposit(2, usdcVal(5));
    tokenInfo = poolTokens.getTokenInfo(tokenId);

    _startImpersonation(GF_OWNER);
    tp.grantRole(TestConstants.SENIOR_ROLE, address(this));
    tp.grantRole(TestConstants.SENIOR_ROLE, GF_OWNER);
    _stopImpersonation();
  }

  function testRevertsForNonOwnerNonApprovedOperator(address caller) public impersonating(caller) {
    vm.assume(caller != address(this));
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

  function testSplitRewardsClaimedProportionally(uint256 principal1) public {
    principal1 = bound(principal1, 1, tokenInfo.principalAmount - 1);

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

    uint256 claimableRewards = backerRewards.poolTokenClaimableRewards(tokenId);
    assertTrue(claimableRewards > 0);
    backerRewards.withdraw(tokenId);

    (uint256 token1, uint256 token2) = poolTokens.splitToken(tokenId, principal1);
    IBackerRewards.BackerRewardsTokenInfo memory token1BackerRewardsInfo = backerRewards
      .getTokenInfo(token1);
    IBackerRewards.BackerRewardsTokenInfo memory token2BackerRewardsInfo = backerRewards
      .getTokenInfo(token2);

    assertEq(
      token1BackerRewardsInfo.rewardsClaimed,
      (claimableRewards * principal1) / tokenInfo.principalAmount
    );

    assertEq(
      token2BackerRewardsInfo.rewardsClaimed,
      claimableRewards - (claimableRewards * principal1) / tokenInfo.principalAmount
    );

    assertEq(
      token1BackerRewardsInfo.rewardsClaimed + token2BackerRewardsInfo.rewardsClaimed,
      claimableRewards
    );
  }

  function testUsesAccRewardsPerPrincipalDollarAtMintForSplitTokens() public {
    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(20));
    tp.deposit(1, usdcVal(20));
    // Drawdown and make first interest payment. This will make accRewardsPerPrincipalDollar for the pool non-zero.
    // Then, when we initialize the next slice and deposit, the minted pool token will have a non-zero
    // accRewardsPerPrincipalDollarAtMint
    tp.drawdown(usdcVal(25));
    _stopImpersonation();

    vm.warp(cl.nextDueTime());
    tp.assess();
    tp.pay(cl.interestOwed());

    // Initialize next slice and deposit
    _startImpersonation(GF_OWNER);
    tp.initializeNextSlice(block.timestamp);
    usdc.approve(address(tp), usdcVal(25));
    uint256 juniorTokenSlice2 = tp.deposit(4, usdcVal(5));
    tp.lockJuniorCapital();
    tp.deposit(3, usdcVal(20));
    tp.lockPool();

    IBackerRewards.BackerRewardsTokenInfo memory juniorBackerRewardsInfoSlice2 = backerRewards
      .getTokenInfo(juniorTokenSlice2);

    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(
      juniorTokenSlice2,
      usdcVal(5) / 2
    );
    _stopImpersonation();

    assertEq(
      backerRewards.getTokenInfo(newToken1).accRewardsPerPrincipalDollarAtMint,
      juniorBackerRewardsInfoSlice2.accRewardsPerPrincipalDollarAtMint
    );

    assertEq(
      backerRewards.getTokenInfo(newToken2).accRewardsPerPrincipalDollarAtMint,
      juniorBackerRewardsInfoSlice2.accRewardsPerPrincipalDollarAtMint
    );
  }

  function testUsesAccRewardsPerTokenAtLastWithdrawForSplitTokens() public {
    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(20));
    tp.deposit(1, usdcVal(20));
    vm.warp(block.timestamp + 100);
    tp.drawdown(usdcVal(25));
    _stopImpersonation();

    vm.warp(cl.nextDueTime() + 1);
    tp.assess();
    tp.pay(cl.interestOwed());

    backerRewards.withdraw(tokenId);
    uint256 accRewardsPerTokenAtLastWithdraw = backerRewards
      .getStakingRewardsTokenInfo(tokenId)
      .accumulatedRewardsPerTokenAtLastWithdraw;
    assertEq(accRewardsPerTokenAtLastWithdraw, 0);

    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(tokenId, usdcVal(5) / 2);

    assertEq(
      backerRewards.getStakingRewardsTokenInfo(newToken1).accumulatedRewardsPerTokenAtLastWithdraw,
      accRewardsPerTokenAtLastWithdraw
    );
    assertEq(
      backerRewards.getStakingRewardsTokenInfo(newToken2).accumulatedRewardsPerTokenAtLastWithdraw,
      accRewardsPerTokenAtLastWithdraw
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
    backerRewards.withdraw(tokenId);

    tokenInfo = poolTokens.getTokenInfo(tokenId);
    assertGt(tokenInfo.principalRedeemed, 0);
    assertGt(tokenInfo.interestRedeemed, 0);

    IBackerRewards.BackerRewardsTokenInfo memory backerRewardsTokenInfo = backerRewards
      .getTokenInfo(tokenId);
    assertGt(backerRewardsTokenInfo.rewardsClaimed, 0);

    assertEq(
      backerRewards.getStakingRewardsTokenInfo(tokenId).accumulatedRewardsPerTokenAtLastWithdraw,
      0
    );

    poolTokens.splitToken(tokenId, tokenInfo.principalAmount / 2);
    // Token no longer exists
    vm.expectRevert("ERC721: owner query for nonexistent token");
    poolTokens.ownerOf(tokenId);

    // Token info is deleted
    tokenInfo = poolTokens.getTokenInfo(tokenId);
    assertEq(tokenInfo.pool, address(0));
    assertZero(tokenInfo.tranche);
    assertZero(tokenInfo.principalAmount);
    assertZero(tokenInfo.interestRedeemed);
    assertZero(tokenInfo.principalRedeemed);

    // Backer rewards info is deleted
    backerRewardsTokenInfo = backerRewards.getTokenInfo(tokenId);
    assertZero(backerRewardsTokenInfo.rewardsClaimed);
    assertZero(backerRewardsTokenInfo.accRewardsPerPrincipalDollarAtMint);

    // Staking rewards info is deleted
    assertZero(
      backerRewards.getStakingRewardsTokenInfo(tokenId).accumulatedRewardsPerTokenAtLastWithdraw
    );
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

  function testClaimableRewardsIsSameIfRewardsClaimedBeforeSplit() public {
    // Pay interest => claim rewards => split token => pay off loan

    // We do another junior investment EQUAL to the first. We'll split the first junior investment but not split
    // the second. We can compare them against each other to show that at the end of the day you get the same
    // rewards out of a split vs non-split token.
    uint256 tokenId2 = tp.deposit(2, usdcVal(5));

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(40));
    tp.deposit(1, usdcVal(40));
    tp.drawdown(usdcVal(50));
    _stopImpersonation();

    vm.warp(cl.nextDueTime() + 1);
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed());
    tp.pay(cl.interestOwed());

    assertGt(backerRewards.poolTokenClaimableRewards(tokenId), 0);
    backerRewards.withdraw(tokenId);
    assertZero(backerRewards.poolTokenClaimableRewards(tokenId));

    uint256 principal1 = tokenInfo.principalAmount / 8;
    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(tokenId, principal1);

    // Advance to end of loan and pay
    vm.warp(cl.termEndTime());
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed() + cl.principalOwed());
    tp.pay(cl.interestOwed() + cl.principalOwed());

    // Check total rewards match up
    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfo1 = backerRewards.getTokenInfo(
      newToken1
    );
    uint256 claimableRewards1 = backerRewards.poolTokenClaimableRewards(newToken1);

    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfo2 = backerRewards.getTokenInfo(
      newToken2
    );
    uint256 claimableRewards2 = backerRewards.poolTokenClaimableRewards(newToken2);

    uint256 totalClaimed = bRewardsTokenInfo1.rewardsClaimed + bRewardsTokenInfo2.rewardsClaimed;
    uint256 totalClaimable = claimableRewards1 + claimableRewards2;

    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfoJunior2 = backerRewards
      .getTokenInfo(tokenId2);
    uint256 claimableRewardsJunior2 = backerRewards.poolTokenClaimableRewards(tokenId2);
    uint256 expectedTotalRewards = bRewardsTokenInfoJunior2.rewardsClaimed +
      claimableRewardsJunior2;

    assertEq(
      totalClaimed + totalClaimable,
      expectedTotalRewards,
      "Total rewards should be the same"
    );
  }

  function testClaimableRewardsIsSameIfRewardsClaimedAfterSplit() public {
    // Pay interest => split token => claim rewards => pay off loan

    // We do another junior investment EQUAL to the first. We'll split the first junior investment but not split
    // the second. We can compare them against each other to show that at the end of the day you get the same
    // rewards out of a split vs non-split token.
    uint256 tokenId2 = tp.deposit(2, usdcVal(5));

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(40));
    tp.deposit(1, usdcVal(40));
    tp.drawdown(usdcVal(50));
    _stopImpersonation();

    vm.warp(cl.nextDueTime() + 1);
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed());
    tp.pay(cl.interestOwed());

    uint256 principal1 = tokenInfo.principalAmount / 8;
    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(tokenId, principal1);

    assertGt(backerRewards.poolTokenClaimableRewards(newToken1), 0);
    assertGt(backerRewards.poolTokenClaimableRewards(newToken2), 0);
    backerRewards.withdraw(newToken1);
    backerRewards.withdraw(newToken2);
    assertZero(backerRewards.poolTokenClaimableRewards(newToken1));
    assertZero(backerRewards.poolTokenClaimableRewards(newToken2));

    // Advance to end of loan and pay
    vm.warp(cl.termEndTime());
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed() + cl.principalOwed());
    tp.pay(cl.interestOwed() + cl.principalOwed());

    // Check total rewards match up
    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfo1 = backerRewards.getTokenInfo(
      newToken1
    );
    uint256 claimableRewards1 = backerRewards.poolTokenClaimableRewards(newToken1);

    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfo2 = backerRewards.getTokenInfo(
      newToken2
    );
    uint256 claimableRewards2 = backerRewards.poolTokenClaimableRewards(newToken2);

    uint256 totalClaimed = bRewardsTokenInfo1.rewardsClaimed + bRewardsTokenInfo2.rewardsClaimed;
    uint256 totalClaimable = claimableRewards1 + claimableRewards2;

    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfoJunior2 = backerRewards
      .getTokenInfo(tokenId2);
    uint256 claimableRewardsJunior2 = backerRewards.poolTokenClaimableRewards(tokenId2);
    uint256 expectedTotalRewards = bRewardsTokenInfoJunior2.rewardsClaimed +
      claimableRewardsJunior2;

    assertEq(
      totalClaimed + totalClaimable,
      expectedTotalRewards,
      "Total rewards should be the same"
    );
  }

  function testClaimableRewardsIsSameIfNoRewardsClaimed() public {
    // Pay interest => split token => pay off loan

    // We do another junior investment EQUAL to the first. We'll split the first junior investment but not split
    // the second. We can compare them against each other to show that at the end of the day you get the same
    // rewards out of a split vs non-split token.
    uint256 tokenId2 = tp.deposit(2, usdcVal(5));

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(40));
    tp.deposit(1, usdcVal(40));
    tp.drawdown(usdcVal(50));
    _stopImpersonation();

    vm.warp(cl.nextDueTime() + 1);
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed());
    tp.pay(cl.interestOwed());

    uint256 principal1 = tokenInfo.principalAmount / 8;
    (uint256 newToken1, uint256 newToken2) = poolTokens.splitToken(tokenId, principal1);

    // Advance to end of loan and pay
    vm.warp(cl.termEndTime());
    tp.assess();
    usdc.approve(address(tp), cl.interestOwed() + cl.principalOwed());
    tp.pay(cl.interestOwed() + cl.principalOwed());

    // Check total rewards match up
    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfo1 = backerRewards.getTokenInfo(
      newToken1
    );
    uint256 claimableRewards1 = backerRewards.poolTokenClaimableRewards(newToken1);

    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfo2 = backerRewards.getTokenInfo(
      newToken2
    );
    uint256 claimableRewards2 = backerRewards.poolTokenClaimableRewards(newToken2);

    uint256 totalClaimed = bRewardsTokenInfo1.rewardsClaimed + bRewardsTokenInfo2.rewardsClaimed;
    uint256 totalClaimable = claimableRewards1 + claimableRewards2;

    IBackerRewards.BackerRewardsTokenInfo memory bRewardsTokenInfoJunior2 = backerRewards
      .getTokenInfo(tokenId2);
    uint256 claimableRewardsJunior2 = backerRewards.poolTokenClaimableRewards(tokenId2);
    uint256 expectedTotalRewards = bRewardsTokenInfoJunior2.rewardsClaimed +
      claimableRewardsJunior2;

    assertEq(
      totalClaimed + totalClaimable,
      expectedTotalRewards,
      "Total rewards should be the same"
    );
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

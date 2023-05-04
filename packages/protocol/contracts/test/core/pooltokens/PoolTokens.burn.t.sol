// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {IBackerRewards} from "../../../interfaces/IBackerRewards.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract PoolTokensBurnTest is PoolTokensBaseTest {
  TranchedPool private tp;
  CreditLine private cl;
  uint256 private tokenId;
  IPoolTokens.TokenInfo private tokenInfo;

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
    usdc.approve(address(tp), type(uint256).max);
    tokenId = tp.deposit(2, usdcVal(5));
    tokenInfo = poolTokens.getTokenInfo(tokenId);

    _startImpersonation(GF_OWNER);
    tp.grantRole(TestConstants.SENIOR_ROLE, address(this));
    tp.grantRole(TestConstants.SENIOR_ROLE, GF_OWNER);
    _stopImpersonation();
  }

  function testRevertsIfPrincipalNotFullyRedeemed(uint256 principalToRedeem) public {
    principalToRedeem = bound(principalToRedeem, 1, tokenInfo.principalAmount - 1);
    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(tokenId, principalToRedeem, 0);

    vm.expectRevert("Can only burn fully redeemed tokens");
    poolTokens.burn(tokenId);
  }

  function testRevertsIfBackerRewardsNotFullyRedeemed() public {
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

    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(tokenId, tokenInfo.principalAmount, 0);

    vm.expectRevert("rewards>0");
    poolTokens.burn(tokenId);
  }

  function testCanBurnOnceFullyRedeemed() public {
    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(tokenId, tokenInfo.principalAmount, 0);
    // Should not revert
    poolTokens.burn(tokenId);
  }

  function testBurnDeletesAllTokenData() public {
    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    usdc.approve(address(tp), usdcVal(20));
    tp.deposit(1, usdcVal(20));
    tp.drawdown(usdcVal(25));
    _stopImpersonation();

    vm.warp(cl.termEndTime() + 1);
    tp.assess();
    tp.pay(cl.interestOwed() + cl.principalOwed());

    tp.withdrawMax(tokenId);
    backerRewards.withdraw(tokenId);

    IPoolTokens.TokenInfo memory tokenInfoBeforeBurn = poolTokens.getTokenInfo(tokenId);
    IBackerRewards.BackerRewardsTokenInfo memory backerRewardsInfoBeforeBurn = backerRewards
      .getTokenInfo(tokenId);
    uint256 accRewardsPerTokenAtLastWithdrawBeforeBurn = backerRewards
      .getStakingRewardsTokenInfo(tokenId)
      .accumulatedRewardsPerTokenAtLastWithdraw;

    assertGt(tokenInfoBeforeBurn.principalRedeemed, 0);
    assertGt(tokenInfoBeforeBurn.interestRedeemed, 0);
    assertGt(backerRewardsInfoBeforeBurn.rewardsClaimed, 0);
    assertEq(accRewardsPerTokenAtLastWithdrawBeforeBurn, 0);

    poolTokens.burn(tokenId);

    IPoolTokens.TokenInfo memory tokenInfoAfterBurn = poolTokens.getTokenInfo(tokenId);
    IBackerRewards.BackerRewardsTokenInfo memory backerRewardsInfoAfterBurn = backerRewards
      .getTokenInfo(tokenId);
    uint256 accRewardsPerTokenAtLastWithdrawAfterBurn = backerRewards
      .getStakingRewardsTokenInfo(tokenId)
      .accumulatedRewardsPerTokenAtLastWithdraw;

    assertZero(tokenInfoAfterBurn.principalAmount);
    assertZero(tokenInfoAfterBurn.principalRedeemed);
    assertZero(tokenInfoAfterBurn.interestRedeemed);
    assertZero(tokenInfoAfterBurn.tranche);
    assertEq(tokenInfoAfterBurn.pool, address(0));

    assertZero(backerRewardsInfoAfterBurn.rewardsClaimed);
    assertZero(backerRewardsInfoAfterBurn.accRewardsPerPrincipalDollarAtMint);

    assertZero(accRewardsPerTokenAtLastWithdrawAfterBurn);
  }

  function testEmitsTokenBurnedEvent() public {
    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(tokenId, tokenInfo.principalAmount, 0);

    vm.expectEmit(true, true, true, false);
    emit TokenBurned({owner: address(this), pool: address(tp), tokenId: tokenId});

    poolTokens.burn(tokenId);
  }

  function testEmitsTransferEvent() public {
    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(tokenId, tokenInfo.principalAmount, 0);

    vm.expectEmit(true, true, true, false);
    emit Transfer({_from: address(this), _to: address(0), _tokenId: tokenId});

    poolTokens.burn(tokenId);
  }

  function testRevertsIfPaused() public impersonating(GF_OWNER) {
    poolTokens.pause();
    vm.expectRevert("Pausable: paused");
    poolTokens.burn(tokenId);
  }

  event TokenBurned(address indexed owner, address indexed pool, uint256 indexed tokenId);
  event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
}

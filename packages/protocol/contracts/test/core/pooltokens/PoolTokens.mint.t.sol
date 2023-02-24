// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {IBackerRewards} from "../../../interfaces/IBackerRewards.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";

contract PoolTokensMintTest is PoolTokensBaseTest {
  TranchedPool private tp;
  CreditLine private cl;

  function setUp() public override {
    super.setUp();
    (tp, cl) = defaultTp();
    fundAddress(address(this), usdcVal(2_000_000));
    usdc.approve(address(tp), uint256(-1));
  }

  function testRevertsForPoolNotCreatedByGfFactory() public {
    TranchedPool badTp = new TranchedPool();
    uint256[] memory uidTypes = new uint256[](0);
    badTp.initialize({
      _config: address(gfConfig),
      _borrower: address(this),
      _juniorFeePercent: 20,
      _limit: usdcVal(1000),
      _interestApr: 15000,
      _schedule: tpBuilder.defaultSchedule(),
      _lateFeeApr: 350,
      _fundableAt: 0,
      _allowedUIDTypes: uidTypes
    });

    _startImpersonation(GF_OWNER);
    badTp.grantRole(TestConstants.SENIOR_ROLE, address(this));
    _stopImpersonation();

    usdc.approve(address(badTp), usdcVal(1));
    vm.expectRevert("Invalid pool!");
    badTp.deposit(1, usdcVal(1));
  }

  function testWorksForPoolCreatedByGfFactory() public {
    // Should be fulfilled without reverting
    tp.deposit(2, usdcVal(1));
  }

  function testMintsTokenToDepositor() public {
    assertZero(poolTokens.balanceOf(address(this)));
    tp.deposit(2, usdcVal(1));
    assertEq(poolTokens.balanceOf(address(this)), 1);
  }

  function testSetsPoolTokensTokenInfo(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_00));

    uint256 tokenId = tp.deposit(2, amount);

    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);
    assertEq(tokenInfo.principalAmount, amount);
    assertEq(tokenInfo.pool, address(tp));
  }

  function testSetsBackerRewardsTokenInfo() public {
    uint256 tokenId = tp.deposit(2, usdcVal(1));

    IBackerRewards.BackerRewardsTokenInfo memory backerRewardsTokenInfo = backerRewards
      .getTokenInfo(tokenId);

    assertZero(backerRewardsTokenInfo.rewardsClaimed);
    assertZero(backerRewardsTokenInfo.accRewardsPerPrincipalDollarAtMint);
  }

  function testUsesCurrentAccRewardsPerPrincipalDollarAtMintOnSecondDrawdown() public {
    // We need a tp with a non-zero principalGracePeriod. Otherwise we can't initialize a second slice
    (tp, cl) = tpWithSchedule(12, 1, 6, 1);
    fundAddress(address(this), usdcVal(2_000_000));
    usdc.approve(address(tp), uint256(-1));

    _startImpersonation(GF_OWNER);
    // Setup backer rewards
    gfi.setCap(100_000_000 * 1e18);
    gfi.mint(GF_OWNER, 100_000_000 * 1e18);
    backerRewards.setMaxInterestDollarsEligible(1_000_000_000 * 1e18);
    backerRewards.setTotalRewards(3_000_000 * 1e18);
    stakingRewards.setRewardsParameters({
      _targetCapacity: 1000 * 1e18,
      _minRate: 100 * 1e18,
      _maxRate: 1000 * 1e18,
      _minRateAtPercent: 3 * 1e18,
      _maxRateAtPercent: 5 * 1e17
    });
    gfi.approve(address(stakingRewards), 1000 * 1e18);
    stakingRewards.loadRewards(1000 * 1e18);

    // Approve this address to make senior pool deposits
    tp.grantRole(TestConstants.SENIOR_ROLE, address(this));
    _stopImpersonation();

    tp.deposit(1, usdcVal(5));
    tp.deposit(2, usdcVal(5));

    _startImpersonation(GF_OWNER);
    tp.lockJuniorCapital();
    tp.lockPool();
    tp.drawdown(usdcVal(10));
    _stopImpersonation();

    // Ensure pool has some interst rewards allocated to it advancing time and paying interest
    vm.warp(block.timestamp + 100 days);
    tp.assess();
    tp.pay(usdcVal(5));

    uint256 accRewardsPerPrincipalDollarAfterPayment = backerRewards.pools(address(tp));
    assertTrue(accRewardsPerPrincipalDollarAfterPayment > 0);

    _startImpersonation(GF_OWNER);
    tp.initializeNextSlice(0);
    _stopImpersonation();

    // Deposit 5 dollars into the next slice
    uint256 tokenId = tp.deposit(3, usdcVal(5));
    IBackerRewards.BackerRewardsTokenInfo memory backerRewardsTokenInfo = backerRewards
      .getTokenInfo(tokenId);
    assertZero(backerRewardsTokenInfo.rewardsClaimed);
    assertEq(
      backerRewardsTokenInfo.accRewardsPerPrincipalDollarAtMint,
      accRewardsPerPrincipalDollarAfterPayment
    );
  }

  function testSetsPoolInfo(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(100_000));

    tp.deposit(2, amount);

    IPoolTokens.PoolInfo memory poolInfo = poolTokens.getPoolInfo(address(tp));

    assertEq(poolInfo.totalMinted, amount);
    assertZero(poolInfo.totalPrincipalRedeemed);
    assertTrue(poolInfo.created);
  }

  function testCanMintIfNewTotalDepositsExceedsLimit() public {
    uint256 amount = cl.limit() + usdcVal(1);
    uint256 tokenId = tp.deposit(2, amount);

    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(tokenId);
    assertEq(tokenInfo.principalAmount, amount);
  }

  function testEmitsTokenMintedEvent(uint256 depositAmount) public {
    depositAmount = bound(depositAmount, usdcVal(1), cl.maxLimit());

    vm.expectEmit(true, true, true, true);
    emit TokenMinted({
      owner: address(this),
      pool: address(tp),
      tokenId: 1, // hardcoded because we know it's the first deposit
      amount: depositAmount,
      tranche: 2 // junior
    });
    tp.deposit(2, depositAmount);
  }

  function testEmitsTransferEvent(uint256 depositAmount) public {
    depositAmount = bound(depositAmount, usdcVal(1), cl.maxLimit());

    vm.expectEmit(true, true, true, false);
    emit Transfer({_from: address(0), _to: address(this), _tokenId: 1});

    tp.deposit(2, depositAmount);
  }

  function testIfPausedThenReverts() public {
    _startImpersonation(GF_OWNER);
    poolTokens.pause();
    assertTrue(poolTokens.paused());
    _stopImpersonation();

    vm.expectRevert("Pausable: paused");
    tp.deposit(2, usdcVal(1));
  }

  event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);

  event TokenMinted(
    address indexed owner,
    address indexed pool,
    uint256 indexed tokenId,
    uint256 amount,
    uint256 tranche
  );
}

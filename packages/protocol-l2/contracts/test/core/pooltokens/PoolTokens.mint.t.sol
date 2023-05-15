// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
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
    usdc.approve(address(tp), type(uint256).max);
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

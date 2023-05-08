// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract PoolTokensBurnTest is PoolTokensBaseTest {
  TranchedPool private tp;
  CreditLine private cl;
  uint256 private tokenId;
  IPoolTokens.TokenInfo private tokenInfo;

  function setUp() public override {
    super.setUp();

    // Setup backer rewards
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

  function testRevertsIfPrincipalNotFullyRedeemed(uint256 principalToRedeem) public {
    principalToRedeem = bound(principalToRedeem, 1, tokenInfo.principalAmount - 1);
    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(tokenId, principalToRedeem, 0);

    vm.expectRevert("Can only burn fully redeemed tokens");
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

    IPoolTokens.TokenInfo memory tokenInfoBeforeBurn = poolTokens.getTokenInfo(tokenId);

    assertGt(tokenInfoBeforeBurn.principalRedeemed, 0);
    assertGt(tokenInfoBeforeBurn.interestRedeemed, 0);

    poolTokens.burn(tokenId);

    IPoolTokens.TokenInfo memory tokenInfoAfterBurn = poolTokens.getTokenInfo(tokenId);

    assertZero(tokenInfoAfterBurn.principalAmount);
    assertZero(tokenInfoAfterBurn.principalRedeemed);
    assertZero(tokenInfoAfterBurn.interestRedeemed);
    assertZero(tokenInfoAfterBurn.tranche);
    assertEq(tokenInfoAfterBurn.pool, address(0));
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

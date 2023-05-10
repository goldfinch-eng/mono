// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

contract PoolTokensRedeemTest is PoolTokensBaseTest {
  TranchedPool private tp;
  CreditLine private cl;

  uint256 private token1;
  IPoolTokens.TokenInfo private tokenInfo1;

  uint256 private token2;
  IPoolTokens.TokenInfo private tokenInfo2;

  function setUp() public override {
    super.setUp();
    (tp, cl) = defaultTp();

    fundAddress(address(this), usdcVal(10_000));
    usdc.approve(address(tp), type(uint256).max);

    // First junior deposit
    token1 = tp.deposit(2, usdcVal(5));
    tokenInfo1 = poolTokens.getTokenInfo(token1);

    // Second junior deposit
    token2 = tp.deposit(2, usdcVal(50));
    tokenInfo2 = poolTokens.getTokenInfo(token2);
  }

  function testUpdatesTokenInfo(uint256 principalToRedeem, uint256 interestToRedeem) public {
    uint256 originalPrincipalAmount = tokenInfo1.principalAmount;
    vm.assume(principalToRedeem <= originalPrincipalAmount);
    _startImpersonation(address(tp));

    poolTokens.redeem(token1, principalToRedeem, interestToRedeem);
    tokenInfo1 = poolTokens.getTokenInfo(token1);

    assertEq(tokenInfo1.principalRedeemed, principalToRedeem);
    assertEq(tokenInfo1.interestRedeemed, interestToRedeem);
    assertEq(tokenInfo1.principalAmount, originalPrincipalAmount);
  }

  function testCannotRedeemMoreThanMinted(
    uint256 principalToRedeem,
    uint256 interestToRedeem
  ) public {
    IPoolTokens.PoolInfo memory poolInfo = poolTokens.getPoolInfo(address(tp));
    vm.assume(principalToRedeem > poolInfo.totalMinted);

    _startImpersonation(address(tp));
    vm.expectRevert("Cannot redeem more than we minted");
    poolTokens.redeem(token1, principalToRedeem, interestToRedeem);
  }

  function testCanRedeemUpToTokenPrincipalAmount(uint256 principal1, uint256 principal2) public {
    principal1 = bound(principal1, 1, tokenInfo1.principalAmount);
    principal2 = bound(principal2, 1, tokenInfo2.principalAmount);

    _startImpersonation(address(tp));
    poolTokens.redeem(token1, principal1, 0);
    poolTokens.redeem(token2, principal2, 0);

    assertEq(poolTokens.getTokenInfo(token1).principalRedeemed, principal1);
    assertEq(poolTokens.getTokenInfo(token2).principalRedeemed, principal2);
  }

  function testCanRedeemASecondTimeUpToRemainingAmount(uint256 principalToRedeem1) public {
    principalToRedeem1 = bound(principalToRedeem1, 1, tokenInfo1.principalAmount - 1);
    uint256 principalToRedeem2 = tokenInfo1.principalAmount - principalToRedeem1;

    _startImpersonation(address(tp));

    poolTokens.redeem(token1, principalToRedeem1, 0);
    assertEq(poolTokens.getTokenInfo(token1).principalRedeemed, principalToRedeem1);

    poolTokens.redeem(token1, principalToRedeem2, 0);
    assertEq(
      poolTokens.getTokenInfo(token1).principalRedeemed,
      principalToRedeem1 + principalToRedeem2
    );
  }

  function testRevertsIfRedeemMoreThanPrincipalAmount(uint256 principalToRedeem) public {
    principalToRedeem = bound(
      principalToRedeem,
      tokenInfo1.principalAmount + 1,
      tokenInfo1.principalAmount + tokenInfo2.principalAmount
    );
    _startImpersonation(address(tp));
    vm.expectRevert("Cannot redeem more than principal-deposited amount for token");
    poolTokens.redeem(token1, principalToRedeem, 0);
  }

  function testRevertsIfRedeemMoreThanPrincipalAmountOnSecondRedemption(
    uint256 principalToRedeem
  ) public {
    // Redeem a valid amount
    _startImpersonation(address(tp));
    poolTokens.redeem(token1, usdcVal(1), 0);

    // We have $4 left to redeem. Any amount greater (but under total minted) should trigger
    // the revert
    uint256 totalMinted = tokenInfo1.principalAmount + tokenInfo2.principalAmount;
    principalToRedeem = bound(principalToRedeem, usdcVal(4) + 1, totalMinted - usdcVal(4));
    vm.expectRevert("Cannot redeem more than principal-deposited amount for token");
    poolTokens.redeem(token1, principalToRedeem, 0);
  }

  function testRevertsForNonExistentToken(uint256 badTokenId) public {
    vm.assume(badTokenId != token1 && badTokenId != token2);
    poolTokens._disablePoolValidation(true);
    vm.expectRevert("Invalid tokenId");
    poolTokens.redeem(badTokenId, usdcVal(1), usdcVal(1));
  }

  function testRevertsForWrongPool() public {
    poolTokens._disablePoolValidation(true);
    _startImpersonation(address(this));
    vm.expectRevert("Only the token's pool can redeem");
    poolTokens.redeem(token1, usdcVal(1), usdcVal(2));
  }

  function testEmitsTokenRedeemedEvent(uint256 principalToRedeem, uint256 interestToRedeem) public {
    principalToRedeem = bound(principalToRedeem, 1, tokenInfo1.principalAmount);
    _startImpersonation(address(tp));
    vm.expectEmit(true, true, true, true);
    emit TokenRedeemed({
      owner: address(this),
      pool: address(tp),
      tokenId: token1,
      principalRedeemed: principalToRedeem,
      interestRedeemed: interestToRedeem,
      tranche: 2
    });
    poolTokens.redeem(token1, principalToRedeem, interestToRedeem);
  }

  function testRevertsWhenPaused() public impersonating(GF_OWNER) {
    poolTokens.pause();
    _startImpersonation(address(tp));
    vm.expectRevert("Pausable: paused");
    poolTokens.redeem(token1, 1, 1);
  }

  event TokenRedeemed(
    address indexed owner,
    address indexed pool,
    uint256 indexed tokenId,
    uint256 principalRedeemed,
    uint256 interestRedeemed,
    uint256 tranche
  );
}

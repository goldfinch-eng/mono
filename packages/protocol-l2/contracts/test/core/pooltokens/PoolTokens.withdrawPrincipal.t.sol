// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

contract PoolTokensWithdrawPrincipalTest is PoolTokensBaseTest {
  TranchedPool private tp;
  CreditLine private cl;
  uint256 private tokenId;
  IPoolTokens.TokenInfo private tokenInfo;

  function setUp() public override {
    super.setUp();
    (tp, cl) = defaultTp();
    fundAddress(address(this), usdcVal(10_000));
    usdc.approve(address(tp), type(uint256).max);

    // Junior deposit
    tokenId = tp.deposit(2, usdcVal(5));
    tokenInfo = poolTokens.getTokenInfo(tokenId);
  }

  function testRevertsIfPaused() public impersonating(GF_OWNER) {
    poolTokens._disablePoolValidation(true);
    poolTokens.pause();
    assertTrue(poolTokens.paused());
    vm.expectRevert("Pausable: paused");
    poolTokens.withdrawPrincipal(1, usdcVal(1));
  }

  function testRevertsForNonExistentToken(uint256 badTokenId) public {
    poolTokens._disablePoolValidation(true);
    vm.assume(badTokenId != tokenId);
    vm.expectRevert("Invalid sender");
    poolTokens.withdrawPrincipal(badTokenId, usdcVal(1));
  }

  function testRevertsForValidTokenButWrongPoolSender(address payable badPool) public {
    vm.assume(badPool != address(tp));
    // The tokenId is valid but the pool is wrong
    _startImpersonation(badPool);

    vm.expectRevert("Invalid pool!");
    poolTokens.withdrawPrincipal(tokenId, usdcVal(1));
  }

  function testRevertsIfTokenAlreadyRedeemed(
    uint256 redeemAmount,
    uint256 withdrawalAmount
  ) public {
    redeemAmount = bound(redeemAmount, 1, tokenInfo.principalAmount);
    vm.assume(withdrawalAmount > 0);

    _startImpersonation(address(tp));
    poolTokens.redeem(tokenId, tokenInfo.principalAmount, 0);
    vm.expectRevert("Token redeemed");
    poolTokens.withdrawPrincipal(tokenId, withdrawalAmount);
  }

  function testWithdrawMoreThanPrincipalAmountReverts(uint256 withdrawalAmount) public {
    vm.assume(withdrawalAmount > tokenInfo.principalAmount);
    _startImpersonation(address(tp));
    vm.expectRevert("Insufficient principal");
    poolTokens.withdrawPrincipal(tokenId, withdrawalAmount);
  }

  function testUpdatesTokenInfo(uint256 withdrawalAmount) public {
    withdrawalAmount = bound(withdrawalAmount, 1, tokenInfo.principalAmount);
    _startImpersonation(address(tp));
    poolTokens.withdrawPrincipal(tokenId, withdrawalAmount);

    IPoolTokens.TokenInfo memory tokenInfoAfterWithdrawal = poolTokens.getTokenInfo(tokenId);
    assertZero(tokenInfoAfterWithdrawal.principalRedeemed);
    assertZero(tokenInfoAfterWithdrawal.interestRedeemed);
    assertEq(tokenInfoAfterWithdrawal.tranche, 2);
    assertEq(tokenInfoAfterWithdrawal.pool, address(tp));
    assertEq(
      tokenInfoAfterWithdrawal.principalAmount,
      tokenInfo.principalAmount - withdrawalAmount
    );
  }

  function testDecrementsPoolTotalMinted(uint256 withdrawalAmount) public {
    withdrawalAmount = bound(withdrawalAmount, 1, tokenInfo.principalAmount);
    _startImpersonation(address(tp));

    IPoolTokens.PoolInfo memory poolInfoBefore = poolTokens.getPoolInfo(address(tp));
    poolTokens.withdrawPrincipal(tokenId, withdrawalAmount);
    IPoolTokens.PoolInfo memory poolInfoAfter = poolTokens.getPoolInfo(address(tp));

    assertEq(poolInfoAfter.totalMinted, poolInfoBefore.totalMinted - withdrawalAmount);
    assertEq(poolInfoAfter.totalPrincipalRedeemed, poolInfoBefore.totalPrincipalRedeemed);
    assertEq(poolInfoAfter.created, poolInfoBefore.created);
  }

  function testEmitsTokenPrincipalWithdrawnEvent(uint256 withdrawalAmount) public {
    withdrawalAmount = bound(withdrawalAmount, 1, tokenInfo.principalAmount);
    _startImpersonation(address(tp));

    vm.expectEmit(true, true, true, true);
    emit TokenPrincipalWithdrawn({
      owner: address(this),
      pool: address(tp),
      tokenId: tokenId,
      principalWithdrawn: withdrawalAmount,
      tranche: 2
    });
    poolTokens.withdrawPrincipal(tokenId, withdrawalAmount);
  }

  event TokenPrincipalWithdrawn(
    address indexed owner,
    address indexed pool,
    uint256 indexed tokenId,
    uint256 principalWithdrawn,
    uint256 tranche
  );
}

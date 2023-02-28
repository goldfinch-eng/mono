// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

contract PoolTokensReducePrincipalAmountTest is PoolTokensBaseTest {
  TranchedPool private tp;
  CreditLine private cl;
  uint256 private token;
  IPoolTokens.TokenInfo private tokenInfo;

  function setUp() public override {
    super.setUp();
    (tp, cl) = defaultTp();

    fundAddress(address(this), usdcVal(10_000));
    usdc.approve(address(tp), type(uint256).max);

    token = tp.deposit(2, usdcVal(5));
    tokenInfo = poolTokens.getTokenInfo(token);
  }

  function testReductionByAmountMoreThanRedeemedTriggersOverflow(
    uint256 principalToRedeem,
    uint256 amountToReduceBy
  ) public impersonating(GF_OWNER) {
    principalToRedeem = bound(principalToRedeem, 1, tokenInfo.principalAmount);
    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(token, principalToRedeem, 0);

    vm.assume(amountToReduceBy > principalToRedeem);
    poolTokens._setSender(payable(address(tp)));
    vm.expectRevert("SafeMath: subtraction overflow");
    poolTokens.reducePrincipalAmount(token, amountToReduceBy);
  }

  function testRevertsForNonOwner(
    address caller,
    uint256 tokenId,
    uint256 amount
  ) public impersonating(caller) {
    vm.assume(caller != GF_OWNER);
    vm.expectRevert(bytes("AD"));
    poolTokens.reducePrincipalAmount(tokenId, amount);
  }

  function testReducesPrincipalAmount(uint256 principalToRedeem, uint256 amountToReduce) public {
    principalToRedeem = bound(principalToRedeem, 1, tokenInfo.principalAmount);
    poolTokens._setSender(payable(address(tp)));
    poolTokens.redeem(token, principalToRedeem, 0);

    tokenInfo = poolTokens.getTokenInfo(token);
    amountToReduce = bound(amountToReduce, 0, principalToRedeem);
    _startImpersonation(GF_OWNER);
    poolTokens.reducePrincipalAmount(token, amountToReduce);

    assertEq(
      poolTokens.getTokenInfo(token).principalAmount,
      tokenInfo.principalAmount - amountToReduce,
      "principalAmount should be reduced by amountToReduce"
    );

    assertEq(
      poolTokens.getTokenInfo(token).principalRedeemed,
      tokenInfo.principalRedeemed - amountToReduce,
      "principalRedeemed should be reduced by amountToReduce"
    );
  }
}

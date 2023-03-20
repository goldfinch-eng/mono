// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";

contract SeniorPoolWithdrawTest is SeniorPoolBaseTest {
  function testNonZapperCannotWithdraw(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) {
    vm.expectRevert("Not Zapper");
    sp.withdraw(amount);
  }

  function testWithdrawUpToUsdcAvailableWorks(
    address user,
    uint256 withdrawAmount,
    uint256 depositAmount,
    uint256 spStartingUsdc
  ) public impersonating(user) {
    vm.assume(fuzzHelper.isAllowed(user));
    addToGoList(user);
    approveTokensMaxAmount(user);
    grantRole(address(sp), TestConstants.ZAPPER_ROLE, user);

    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    withdrawAmount = bound(withdrawAmount, usdcVal(1), depositAmount);
    // Check that we can only withdraw up to usdcAvailable even if usdc.balanceOf(sp) > usdcAvailable
    spStartingUsdc = bound(spStartingUsdc, 0, usdcVal(10_000_000));
    fundAddress(address(sp), spStartingUsdc);
    fundAddress(user, depositAmount);

    sp.deposit(depositAmount);

    vm.expectEmit(true, false, false, true);
    emit WithdrawalMade(user, withdrawAmount, 0);

    uint256 spUsdcAvail = sp.usdcAvailable();
    uint256 userUsdcBefore = usdc.balanceOf(user);
    uint256 userFiduBefore = fidu.balanceOf(user);
    uint256 spUsdcBefore = usdc.balanceOf(address(sp));
    uint256 fiduSupplyBefore = fidu.totalSupply();

    sp.withdraw(withdrawAmount);

    // Increases usdcAvailable
    assertEq(sp.usdcAvailable(), spUsdcAvail - withdrawAmount);
    // Transfers udsc TO the withdrawer
    assertEq(usdc.balanceOf(user), userUsdcBefore + withdrawAmount);
    // Burns the withdrawer's fidu
    assertEq(fidu.balanceOf(user), userFiduBefore - sp.getNumShares(withdrawAmount));
    assertEq(fidu.totalSupply(), fiduSupplyBefore - sp.getNumShares(withdrawAmount));
    // Transfers usdc FROM the pool
    assertEq(usdc.balanceOf(address(sp)), spUsdcBefore - withdrawAmount);
  }

  function testWithdrawRevertsIfYouWithdrawMoreThanUsdcAvailable(
    address user,
    uint256 depositAmount
  )
    public
    onlyAllowListed(user)
    impersonating(user)
    goListed(user)
    withRole(user, TestConstants.ZAPPER_ROLE)
    tokenApproved(user)
  {
    depositAmount = bound(depositAmount, usdcVal(100), usdcVal(10_000_000));
    fundAddress(user, depositAmount);
    depositToSpFrom(user, depositAmount);

    (TranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    vm.expectRevert(bytes("IB"));
    sp.withdraw(depositAmount);
  }

  function testWithdrawRevertsIfYouWithdrawMoreThanYouHave(
    address user1,
    address user2,
    uint256 depositAmount1,
    uint256 depositAmount2,
    uint256 withdrawAmount
  )
    public
    onlyAllowListed(user1)
    onlyAllowListed(user2)
    goListed(user1)
    goListed(user2)
    tokenApproved(user1)
    tokenApproved(user2)
  {
    vm.assume(user1 != user2);
    grantRole(address(sp), TestConstants.ZAPPER_ROLE, user1);
    grantRole(address(sp), TestConstants.ZAPPER_ROLE, user2);
    depositAmount1 = bound(depositAmount1, usdcVal(1), usdcVal(10_000_000));
    depositAmount2 = bound(depositAmount2, usdcVal(1), usdcVal(10_000_000));
    withdrawAmount = bound(
      withdrawAmount,
      depositAmount1 + usdcVal(1),
      depositAmount1 + depositAmount2
    );
    fundAddress(user1, depositAmount1);
    fundAddress(user2, depositAmount2);

    depositToSpFrom(user1, depositAmount1);
    depositToSpFrom(user2, depositAmount2);

    vm.expectRevert("Amount requested is greater than what this address owns");
    assertTrue(withdrawAmount > depositAmount1, "What?");
    withdrawFrom(user1, withdrawAmount);
  }

  function testWithdrawLetsYouWithdrawExactHoldings(
    address user,
    uint256 depositAmount
  )
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
    withRole(user, TestConstants.ZAPPER_ROLE)
  {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, depositAmount);
    depositToSpFrom(user, depositAmount);

    uint256 usdcBalanceBefore = usdc.balanceOf(user);
    withdrawFrom(user, depositAmount);
    assertEq(usdc.balanceOf(user), usdcBalanceBefore + depositAmount);
  }

  function testWithdrawInFidu(
    address user,
    uint256 depositAmount
  ) public onlyAllowListed(user) goListed(user) tokenApproved(user) {
    grantRole(address(sp), TestConstants.ZAPPER_ROLE, user);
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, depositAmount);
    depositToSpFrom(user, depositAmount);

    uint256 withdrawAmount = sp.getNumShares(depositAmount);
    vm.expectEmit(true, false, false, true);
    emit WithdrawalMade(user, depositAmount, 0);

    uint256 usdcAvailBefore = sp.usdcAvailable();
    uint256 userUsdcBefore = usdc.balanceOf(user);
    uint256 spUsdcBefore = usdc.balanceOf(address(sp));
    uint256 userFiduBefore = fidu.balanceOf(user);
    uint256 fiduSupplyBefore = fidu.totalSupply();

    withdrawInFiduFrom(user, withdrawAmount);

    assertEq(sp.usdcAvailable(), usdcAvailBefore - depositAmount);
    assertEq(usdc.balanceOf(user), userUsdcBefore + depositAmount);
    assertEq(usdc.balanceOf(address(sp)), spUsdcBefore - depositAmount);
    assertEq(fidu.balanceOf(user), userFiduBefore - withdrawAmount);
    assertEq(fidu.totalSupply(), fiduSupplyBefore - withdrawAmount);
  }
}

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {ISeniorPoolEpochWithdrawals} from "../../../interfaces/ISeniorPoolEpochWithdrawals.sol";

contract SeniorPoolDepositTest is SeniorPoolBaseTest {
  function testDepositRevertsWhenTransferAmountExceedsAllowance(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) {
    amount = bound(amount, 1, 10_000_000);
    fundAddress(user, amount);
    vm.expectRevert(bytes("ERC20: transfer amount exceeds allowance"));
    sp.deposit(amount);
  }

  function testDepositIncreasesUsdcAvailableByDepositedAmount(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) tokenApproved(user) {
    amount = bound(amount, 1, 10_000_000);
    fundAddress(user, amount);

    uint256 usdcAvailableBefore = sp.usdcAvailable();
    sp.deposit(amount);
    assertEq(sp.usdcAvailable(), usdcAvailableBefore + amount);
  }

  function testDepositLiquidatesIfOneOrMoreEpochsHaveEndedSinceLastCheckpoint(
    address user,
    uint256 amount,
    uint256 epochsElapsed
  ) public onlyAllowListed(user) goListed(user) impersonating(user) tokenApproved(user) {
    epochsElapsed = bound(epochsElapsed, 1, 10);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);

    uint256 shares = sp.deposit(amount);
    sp.requestWithdrawal(shares);
    ISeniorPoolEpochWithdrawals.Epoch memory epoch = sp.epochAt(1);

    vm.warp(epoch.endsAt + sp.epochDuration() * epochsElapsed);

    // This deposit should trigger an allocation of (amount - 1) USDC.
    fundAddress(user, usdcVal(1));
    vm.expectEmit(true, false, false, true);
    emit EpochEnded({
      epochId: 1,
      endTime: epoch.endsAt + sp.epochDuration() * epochsElapsed,
      fiduRequested: epoch.fiduRequested,
      usdcAllocated: amount,
      fiduLiquidated: shares
    });
    sp.deposit(usdcVal(1));
    assertEq(sp.usdcAvailable(), usdcVal(1));

    ISeniorPoolEpochWithdrawals.Epoch memory liquidatedEpoch = sp.epochAt(1);
    assertEq(liquidatedEpoch.usdcAllocated, amount);
    assertEq(liquidatedEpoch.fiduLiquidated, shares);
  }

  function testDepositTransferUsdcFromUserToSeniorPool(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) tokenApproved(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);

    uint256 spUsdcBefore = usdc.balanceOf(address(sp));
    uint256 userUsdcBefore = usdc.balanceOf(user);
    sp.deposit(amount);
    assertEq(usdc.balanceOf(address(sp)), spUsdcBefore + amount);
    assertEq(usdc.balanceOf(user), userUsdcBefore - amount);
  }

  function testZeroDepositReverts() public {
    vm.expectRevert("Must deposit more than zero");
    depositToSpFrom(GF_OWNER, 0);
  }

  function testDepositMintsFiduToUser(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) tokenApproved(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);

    uint256 fiduSupplyBefore = fidu.totalSupply();
    uint256 userFiduBefore = fidu.balanceOf(user);

    uint256 shares = sp.deposit(amount);

    assertEq(fidu.totalSupply(), fiduSupplyBefore + shares);
    assertEq(fidu.balanceOf(user), userFiduBefore + shares);
  }

  function testDepositEmitsDepositMade(
    address user,
    uint256 amount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) tokenApproved(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);
    vm.expectEmit(true, false, false, true);
    emit DepositMade(user, amount, sp.getNumShares(amount));
    sp.deposit(amount);
  }

  /*================================================================================
  Deposit with Permit
  ================================================================================*/

  function testDepositWithPermitDepositsForValidPermit(
    uint256 key,
    uint256 amount
  ) public validPrivateKey(key) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    address user = vm.addr(key);

    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, amount);

    (uint8 v, bytes32 r, bytes32 s) = getSignature(user, key, amount);

    uint256 userUsdcBefore = usdc.balanceOf(user);
    uint256 userFiduBefore = fidu.balanceOf(user);
    uint256 fiduSupplyBefore = fidu.totalSupply();
    uint256 usdcAvailBefore = sp.usdcAvailable();
    uint256 spUsdcBefore = usdc.balanceOf(address(sp));

    _startImpersonation(user);
    uint256 shares = sp.depositWithPermit(amount, type(uint256).max, v, r, s);
    _stopImpersonation();

    assertEq(usdc.balanceOf(user), userUsdcBefore - amount);
    assertEq(fidu.balanceOf(user), userFiduBefore + shares);
    assertEq(fidu.totalSupply(), fiduSupplyBefore + shares);
    assertEq(sp.usdcAvailable(), usdcAvailBefore + amount);
    assertEq(usdc.balanceOf(address(sp)), spUsdcBefore + amount);
  }

  function testDepositWithPermitLiquidatesIfOneOrMoreEpochsHaveEndedSinceLastCheckpoint(
    uint256 key,
    uint256 amount,
    uint256 epochsElapsed
  ) public validPrivateKey(key) {
    epochsElapsed = bound(epochsElapsed, 1, 10);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    address user = vm.addr(key);

    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, amount);

    _startImpersonation(user);
    uint256 shares = sp.deposit(amount);
    sp.requestWithdrawal(shares);

    vm.warp(block.timestamp + (2 weeks) * epochsElapsed);

    // This deposit should trigger an allocation of (amount - 1) USDC.
    fundAddress(user, usdcVal(1));
    (uint8 v, bytes32 r, bytes32 s) = getSignature(user, key, usdcVal(1));
    sp.depositWithPermit(usdcVal(1), type(uint256).max, v, r, s);
    assertEq(sp.usdcAvailable(), usdcVal(1));

    ISeniorPoolEpochWithdrawals.Epoch memory liquidatedEpoch = sp.epochAt(1);
    assertEq(liquidatedEpoch.usdcAllocated, amount);
    assertEq(liquidatedEpoch.fiduLiquidated, shares);
    _stopImpersonation();
  }
}

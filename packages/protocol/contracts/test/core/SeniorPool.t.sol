// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {IPoolTokens} from "../../interfaces/IPoolTokens.sol";
import {ISeniorPoolEpochWithdrawals} from "../../interfaces/ISeniorPoolEpochWithdrawals.sol";
import {CreditLine} from "../../protocol/core/CreditLine.sol";
import {TestConstants} from "./TestConstants.t.sol";
import {TestTranchedPool} from "../TestTranchedPool.sol";
import {TestSeniorPoolCaller} from "../../test/TestSeniorPoolCaller.sol";
import {SeniorPoolBaseTest} from "./BaseSeniorPool.t.sol";

contract SeniorPoolTest is SeniorPoolBaseTest {
  /*================================================================================
  Access Controls
  ================================================================================*/

  function testSetsOwner() public {
    assertTrue(sp.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
    assertEq(sp.getRoleAdmin(TestConstants.OWNER_ROLE), TestConstants.OWNER_ROLE);
  }

  function testSetsPauser() public {
    assertTrue(sp.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
    assertEq(sp.getRoleAdmin(TestConstants.PAUSER_ROLE), TestConstants.OWNER_ROLE);
  }

  function testAllowsOwnerToAddToRoles(address nonOwner) public impersonating(GF_OWNER) onlyAllowListed(nonOwner) {
    assertFalse(sp.hasRole(TestConstants.OWNER_ROLE, nonOwner));
    assertFalse(sp.hasRole(TestConstants.PAUSER_ROLE, nonOwner));
    sp.grantRole(TestConstants.OWNER_ROLE, nonOwner);
    sp.grantRole(TestConstants.PAUSER_ROLE, nonOwner);
    assertTrue(sp.hasRole(TestConstants.OWNER_ROLE, nonOwner));
    assertTrue(sp.hasRole(TestConstants.PAUSER_ROLE, nonOwner));
  }

  function testNonOwnerCannotAddToRoles(address nonOwner) public onlyAllowListed(nonOwner) impersonating(nonOwner) {
    vm.expectRevert(bytes("AccessControl: sender must be an admin to grant"));
    sp.grantRole(TestConstants.OWNER_ROLE, nonOwner);
  }

  /*================================================================================
  Pausability
  ================================================================================*/

  function testWhenPausedDisallowsDeposit(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.deposit(amount);
  }

  function testWhenPausedDisallowsWithdraw(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.withdraw(amount);
  }

  function testWhenPausedDisallowsWithdrawInFidu(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.withdrawInFidu(amount);
  }

  function testWhenPausedDisallowsInvest(ITranchedPool pool) public paused {
    vm.expectRevert("Pausable: paused");
    sp.invest(pool);
  }

  function testWhenPausedDisallowsRedeem(uint256 tokenId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.redeem(tokenId);
  }

  function testWhenPausedDisallowsWritedown(uint256 tokenId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.writedown(tokenId);
  }

  function testWhenPausedDisallowsRequestWithdrawal(uint256 amount) public paused {
    vm.expectRevert("Pausable: paused");
    sp.requestWithdrawal(amount);
  }

  function testWhenPausedDisallowsAddToWithdrawalRequest(uint256 amount, uint256 requestId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.addToWithdrawalRequest(amount, requestId);
  }

  function testWhenPausedDisallowsCancelWithdrawalRequest(uint256 requestId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.cancelWithdrawalRequest(requestId);
  }

  function testWhenPausedDisallowsClaimWithdrawalRequest(uint256 requestId) public paused {
    vm.expectRevert("Pausable: paused");
    sp.claimWithdrawalRequest(requestId);
  }

  function testWhenPausedCanUnpause() public paused impersonating(GF_OWNER) {
    sp.unpause();
    assertFalse(sp.paused());
  }

  function testOwnerCanPause() public impersonating(GF_OWNER) {
    sp.pause();
    assertTrue(sp.paused());
  }

  function testNonOwnerCannotPause(address nonOwner) public onlyAllowListed(nonOwner) impersonating(nonOwner) {
    vm.expectRevert(bytes("NA"));
    sp.pause();
  }

  function testNonOwnerCannotUnpause(address nonOwner) public paused onlyAllowListed(nonOwner) impersonating(nonOwner) {
    vm.expectRevert(bytes("NA"));
    sp.unpause();
  }

  /*================================================================================
  Deposit
  ================================================================================*/

  function testDepositRevertsWhenTransferAmountExceedsAllowance(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    impersonating(user)
  {
    amount = bound(amount, 1, 10_000_000);
    fundAddress(user, amount);
    vm.expectRevert(bytes("ERC20: transfer amount exceeds allowance"));
    sp.deposit(amount);
  }

  function testDepositIncreasesUsdcAvailableByDepositedAmount(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    impersonating(user)
    tokenApproved(user)
  {
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

  function testDepositTransferUsdcFromUserToSeniorPool(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    impersonating(user)
    tokenApproved(user)
  {
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

  function testDepositMintsFiduToUser(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    impersonating(user)
    tokenApproved(user)
  {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);

    uint256 fiduSupplyBefore = fidu.totalSupply();
    uint256 userFiduBefore = fidu.balanceOf(user);

    uint256 shares = sp.deposit(amount);

    assertEq(fidu.totalSupply(), fiduSupplyBefore + shares);
    assertEq(fidu.balanceOf(user), userFiduBefore + shares);
  }

  function testDepositEmitsDepositMade(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    impersonating(user)
    tokenApproved(user)
  {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);
    vm.expectEmit(true, false, false, true);
    emit DepositMade(user, amount, sp.getNumShares(amount));
    sp.deposit(amount);
  }

  /*================================================================================
  Deposit with Permit
  ================================================================================*/

  function testDepositWithPermitDepositsForValidPermit(uint256 key, uint256 amount) public validPrivateKey(key) {
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

  /*================================================================================
  getNumShares
  ================================================================================*/

  function testGetNumSharesCalculatesSharesBasedOnSharePrice(uint256 amount, uint256 sharePrice) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    sharePrice = bound(sharePrice, fiduVal(1) / 2, fiduVal(2));
    sp._setSharePrice(sharePrice);
    uint256 expectedNumShares = (((amount * 1e18) / 1e6) * 1e18) / sp.sharePrice();
    assertEq(expectedNumShares, sp.getNumShares(amount));
  }

  /*================================================================================
  Withdraw
  ================================================================================*/

  function testNonZapperCannotWithdraw(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    impersonating(user)
  {
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
    grantRole(TestConstants.ZAPPER_ROLE, user);

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

  function testWithdrawRevertsIfYouWithdrawMoreThanUsdcAvailable(address user, uint256 depositAmount)
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

    (TestTranchedPool tp, ) = defaultTp();
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
    grantRole(TestConstants.ZAPPER_ROLE, user1);
    grantRole(TestConstants.ZAPPER_ROLE, user2);
    depositAmount1 = bound(depositAmount1, usdcVal(1), usdcVal(10_000_000));
    depositAmount2 = bound(depositAmount2, usdcVal(1), usdcVal(10_000_000));
    withdrawAmount = bound(withdrawAmount, depositAmount1 + usdcVal(1), depositAmount1 + depositAmount2);
    fundAddress(user1, depositAmount1);
    fundAddress(user2, depositAmount2);

    depositToSpFrom(user1, depositAmount1);
    depositToSpFrom(user2, depositAmount2);

    vm.expectRevert("Amount requested is greater than what this address owns");
    assertTrue(withdrawAmount > depositAmount1, "What?");
    withdrawFrom(user1, withdrawAmount);
  }

  function testWithdrawLetsYouWithdrawExactHoldings(address user, uint256 depositAmount)
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

  function testWithdrawInFidu(address user, uint256 depositAmount)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    grantRole(TestConstants.ZAPPER_ROLE, user);
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

  /*================================================================================
  Request Withdrawal Access Control Tests
  ================================================================================*/

  function testRequestWithdrawalEoaWorksGoListed(address user, uint256 amount) public {
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    addToGoList(user);
    fundAddress(user, amount);

    depositToSpFrom(user, amount);

    uint256 requestToken = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(user, requestTokens.ownerOf(requestToken));
  }

  function testRequestWithdrawalEoaWorksWithValidUid(
    address user,
    uint256 amount,
    uint256 uidType
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    uidType = bound(uidType, 1, 4);
    vm.assume(uidType != 2);

    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    mintUid(user, uidType, 1, "");
    assertEq(uniqueIdentity.balanceOf(user, uidType), 1);
    fundAddress(user, amount);

    depositToSpFrom(user, amount);

    uint256 requestToken = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(user, requestTokens.ownerOf(requestToken));
  }

  function testRequestWithdrawalRevertsForInvalidUid(
    address user,
    uint256 amount,
    uint256 invalidUidType
  ) public onlyAllowListed(user) {
    invalidUidType = bound(invalidUidType, 5, type(uint256).max);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    mintUid(user, 1, 1, "");
    fundAddress(user, amount);

    depositToSpFrom(user, amount);

    burnUid(user, 1);
    mintUid(user, invalidUidType, 1, "");

    uint256 withdrawAmount = sp.getNumShares(amount);
    vm.expectRevert(bytes("NA"));
    requestWithdrawalFrom(user, withdrawAmount);
  }

  function testRequestWithdrawalRevertsForNoUidAndNoGoList(address user, uint256 amount) public onlyAllowListed(user) {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    mintUid(user, 1, 1, "");
    fundAddress(user, amount);
    depositToSpFrom(user, amount);

    burnUid(user, 1);
    uint256 withdrawAmount = sp.getNumShares(amount);
    vm.expectRevert(bytes("NA"));
    requestWithdrawalFrom(user, withdrawAmount);
  }

  function testRequestWithdrawalFailsWhenCallerIsErc1155ApprovedForInvalidUid(uint256 amount, uint256 invalidUid)
    public
  {
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    mintUid(address(this), 1, 1, "");
    fundAddress(address(this), amount);
    approveTokensMaxAmount(address(this));
    depositToSpFrom(address(this), amount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    uint256 shares = sp.getNumShares(amount);
    transferFidu(address(this), address(caller), shares);

    burnUid(address(this), 1);
    mintUid(address(this), invalidUid, 1, "");

    _startImpersonation(address(this), address(this));
    vm.expectRevert(bytes("NA"));
    caller.requestWithdrawal(shares);
  }

  function testRequestWithdrawalFailsWhenOriginHasValidUidButCallerHasNothing(uint256 amount, uint256 validUid) public {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(address(this));
    mintUid(address(this), validUid, 1, "");
    fundAddress(address(this), amount);
    depositToSpFrom(address(this), amount);

    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    approveForAll(address(this), address(caller), true);
    approveTokensMaxAmount(address(caller));

    uint256 shares = sp.getNumShares(amount);
    transferFidu(address(this), address(caller), shares);

    approveForAll(address(this), address(caller), false);
    _startImpersonation(address(this), address(this));
    vm.expectRevert(bytes("NA"));
    caller.requestWithdrawal(shares);
  }

  function testRequestWithdrawalWorksWhenOriginHasNothingAndCallerIsGoListed(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    fundAddress(address(caller), amount);
    caller.deposit(amount);
    uint256 shares = sp.getNumShares(amount);
    uint256 tokenId = caller.requestWithdrawal(shares);
    assertEq(address(caller), requestTokens.ownerOf(tokenId));
  }

  /*================================================================================
  Request Withdrawal Tests
  ================================================================================*/

  function testRequestWithdrawalRevertsForOutstandingRequest(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    impersonating(user)
  {
    amount = bound(amount, usdcVal(2), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, amount);
    sp.deposit(amount);
    sp.requestWithdrawal(fiduVal(1));
    vm.expectRevert("Existing request");
    sp.requestWithdrawal(fiduVal(1));
  }

  function testRequestWithdrawalSuccess(
    address user,
    uint256 depositAmount,
    uint256 requestAmount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    requestAmount = bound(requestAmount, usdcVal(1), depositAmount);
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);
    sp.deposit(depositAmount);
    uint256 shares = sp.getNumShares(requestAmount);

    vm.expectEmit(true, true, false, true, address(sp));
    emit WithdrawalRequested(1, user, shares);
    assertZero(requestTokens.balanceOf(user));
    uint256 spFiduBefore = fidu.balanceOf(address(sp));
    uint256 userFiduBefore = fidu.balanceOf(user);

    uint256 tokenId = sp.requestWithdrawal(shares);
    assertEq(requestTokens.balanceOf(user), 1);
    assertEq(requestTokens.ownerOf(tokenId), user);
    assertEq(fidu.balanceOf(address(sp)), spFiduBefore + shares);
    assertEq(fidu.balanceOf(user), userFiduBefore - shares);
    ISeniorPoolEpochWithdrawals.Epoch memory epoch = sp.epochAt(1);
    assertEq(epoch.fiduRequested, shares);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.fiduRequested, shares);
    assertZero(request.usdcWithdrawable);
  }

  function testRequestWithdrawalCannotRequestMoreThanYourFiduBalance(
    address user,
    uint256 depositAmount,
    uint256 requestAmount
  ) public onlyAllowListed(user) goListed(user) impersonating(user) {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    requestAmount = bound(requestAmount, depositAmount + usdcVal(1), depositAmount * 10);

    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);
    sp.deposit(depositAmount);
    uint256 shares = sp.getNumShares(requestAmount);

    vm.expectRevert("SafeERC20: low-level call failed");
    sp.requestWithdrawal(shares);
  }

  function testRequestWithdrawalLiquidatesIfOneOrMoreEpochsHaveEndedSinceLastCheckpoint(
    address user1,
    uint256 depositAmount1,
    uint256 requestAmount1,
    address user2,
    uint256 depositAmount2,
    uint256 requestAmount2,
    uint256 epochsElapsed
  ) public {
    vm.assume(user1 != user2);
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));

    addToGoList(user1);
    addToGoList(user2);

    epochsElapsed = bound(epochsElapsed, 1, 10);

    depositAmount1 = bound(depositAmount1, usdcVal(1), usdcVal(10_000_000));
    depositAmount2 = bound(depositAmount2, usdcVal(1), usdcVal(10_000_000));

    requestAmount1 = bound(requestAmount1, usdcVal(1), depositAmount1);
    requestAmount2 = bound(requestAmount2, usdcVal(1), depositAmount2);

    fundAddress(user1, depositAmount1);
    fundAddress(user2, depositAmount2);

    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);

    depositToSpFrom(user1, depositAmount1);
    depositToSpFrom(user2, depositAmount2);

    uint256 requestAmount1InFidu = sp.getNumShares(requestAmount1);
    requestWithdrawalFrom(user1, requestAmount1InFidu);

    vm.warp(block.timestamp + sp.epochDuration() * epochsElapsed);

    uint256 requestAmount2InFidu = sp.getNumShares(requestAmount2);
    // This deposit should trigger a liquidation
    requestWithdrawalFrom(user2, requestAmount2InFidu);

    assertEq(sp.usdcAvailable(), depositAmount1 + depositAmount2 - requestAmount1);

    ISeniorPoolEpochWithdrawals.Epoch memory liquidatedEpoch = sp.epochAt(1);

    assertEq(liquidatedEpoch.usdcAllocated, requestAmount1);
    assertEq(liquidatedEpoch.fiduRequested, requestAmount1InFidu);
    assertEq(liquidatedEpoch.fiduLiquidated, requestAmount1InFidu);
  }

  /*================================================================================
  Add To Withdrawal Access Control Tests
  ================================================================================*/

  function testAddToWithdrawalRequestEoaGoListedWorks(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public onlyAllowListed(user) goListed(user) {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.fiduRequested, requestAmountInFidu + addAmountInFidu);
  }

  function testAddToWithdrawalRequestEoaValidUidWorks(
    address user,
    uint256 requestAmount,
    uint256 addAmount,
    uint256 validUid
  ) public onlyAllowListed(user) {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    mintUid(user, validUid, 1, "");
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.fiduRequested, requestAmountInFidu + addAmountInFidu);
  }

  function testAddToWithdrawalRequestEoaInvalidUidReverts(
    address user,
    uint256 requestAmount,
    uint256 addAmount,
    uint256 invalidUid
  ) public onlyAllowListed(user) {
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    mintUid(user, 1, 1, "");
    mintUid(user, invalidUid, 1, "");
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);

    burnUid(user, 1);
    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
  }

  function testAddtoWithdrawalRequestRevertsWhenEoaHasNoUidOrGoList(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public onlyAllowListed(user) {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_000));
    uint256 depositAmount = requestAmount + addAmount;
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);

    uint256 requestAmountInFidu = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountInFidu);
    uint256 addAmountInFidu = sp.getNumShares(addAmount);

    removeFromGoList(user);
    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(user, addAmountInFidu, tokenId);
  }

  function testAddToWithdrawalRequestRevertsWhenCallerIsNotTokenOwner(
    address depositor,
    uint256 depositAmount,
    address otherUser
  ) public onlyAllowListed(depositor) onlyAllowListed(otherUser) goListed(depositor) goListed(otherUser) {
    vm.assume(depositor != otherUser);
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(depositor);
    fundAddress(depositor, depositAmount);

    depositToSpFrom(depositor, depositAmount);
    uint256 shares = sp.getNumShares(depositAmount);
    uint256 tokenId = requestWithdrawalFrom(depositor, shares);

    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(otherUser, fiduVal(1), tokenId);
  }

  function testAddToWithdrawalRequestWorksWhenOriginIsGoListedAndCallerHasNothing(
    uint256 requestAmount,
    uint256 addAmount
  ) public {
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    uint256 depositAmount = requestAmount + addAmount;
    fundAddress(address(caller), depositAmount);

    caller.deposit(depositAmount);
    uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
    caller.addToWithdrawalRequest(sp.getNumShares(addAmount), tokenId);
  }

  /*================================================================================
  Add To Withdrawal Tests
  ================================================================================*/

  function testAddToWithdrawalRequestAddsToFiduRequested(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), requestAmount);
    addToGoList(user);
    uint256 depositAmount = requestAmount + addAmount;
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    depositToSpFrom(user, depositAmount);
    uint256 requestAmountShares = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestAmountShares);
    uint256 addAmountShares = sp.getNumShares(addAmount);
    uint256 spFiduBefore = fidu.balanceOf(address(sp));
    uint256 userFiduBefore = fidu.balanceOf(user);
    addToWithdrawalRequestFrom(user, addAmountShares, tokenId);

    assertEq(fidu.balanceOf(address(sp)), spFiduBefore + addAmountShares);
    assertEq(fidu.balanceOf(user), userFiduBefore - addAmountShares);
    assertEq(sp.epochAt(1).fiduRequested, requestAmountShares + addAmountShares);
    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, requestAmountShares + addAmountShares);
  }

  function testAddToWithdrawalRequestRevertsForNonTokenOwner(
    address user,
    uint256 requestAmount,
    address notTokenOwner
  ) public {
    vm.assume(user != notTokenOwner);
    vm.assume(fuzzHelper.isAllowed(user));
    vm.assume(fuzzHelper.isAllowed(notTokenOwner));
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user);
    addToGoList(notTokenOwner);
    approveTokensMaxAmount(user);
    approveTokensMaxAmount(notTokenOwner);
    fundAddress(user, requestAmount);

    depositToSpFrom(user, requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, sp.getNumShares(requestAmount));
    uint256 addAmount = fiduVal(1);
    vm.expectRevert(bytes("NA"));
    addToWithdrawalRequestFrom(notTokenOwner, addAmount, tokenId);
  }

  function testAddToWithdrawalRequestRevertsIfAddAmountExceedsFiduBalance(
    address user,
    uint256 requestAmount,
    uint256 addAmount
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
    addAmount = bound(addAmount, usdcVal(1), usdcVal(10_000_100));
    addToGoList(user);

    approveTokensMaxAmount(user);
    fundAddress(user, requestAmount);

    depositToSpFrom(user, requestAmount);
    uint256 requestShares = sp.getNumShares(requestAmount);
    uint256 tokenId = requestWithdrawalFrom(user, requestShares);
    uint256 addShares = sp.getNumShares(addAmount);
    vm.expectRevert("SafeERC20: low-level call failed");
    addToWithdrawalRequestFrom(user, addShares, tokenId);
  }

  function testAddToWithdrawalRequestMultipleTimes(address user)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    fundAddress(user, usdcVal(500));
    depositToSpFrom(user, usdcVal(500));
    uint256 tokenId = requestWithdrawalFrom(user, fiduVal(200));
    for (uint256 i = 0; i < 3; ++i) {
      addToWithdrawalRequestFrom(user, fiduVal(1), tokenId);
    }
    assertEq(sp.epochAt(1).fiduRequested, fiduVal(203));
    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, fiduVal(203));
  }

  function testAddToWithdrawalRequestLiquidatesIfOneOrMoreEpochsHaveEndedSinceLastCheckpoint(
    address user,
    uint256 epochsElapsed
  ) public {
    vm.assume(fuzzHelper.isAllowed(user));
    epochsElapsed = bound(epochsElapsed, 1, 10);
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, usdcVal(400));

    depositToSpFrom(user, usdcVal(400));
    uint256 tokenId = requestWithdrawalFrom(user, fiduVal(100));

    // Invest 1/5th of senior pool usdcAvailable to deplete it
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);

    sp.invest(tp);

    // Put partial liquidty back
    depositToSpFrom(GF_OWNER, usdcVal(50));

    vm.warp(block.timestamp + sp.epochDuration() * epochsElapsed);

    addToWithdrawalRequestFrom(user, fiduVal(200), tokenId);

    ISeniorPoolEpochWithdrawals.Epoch memory liquidatedEpoch = sp.epochAt(1);
    assertEq(liquidatedEpoch.fiduRequested, fiduVal(100));
    assertEq(liquidatedEpoch.fiduLiquidated, fiduVal(50));
    assertEq(liquidatedEpoch.usdcAllocated, usdcVal(50));
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);
    assertEq(request.usdcWithdrawable, usdcVal(50));
    assertEq(request.fiduRequested, fiduVal(250));
  }

  function testAddingToAFullyLiquidatedRequestWorks(address user1, address user2) public {
    // If your request was fully liquidated in epoch i and you add to your request in epoch i + j (j >= 1)
    // Then the added amount should not receive liquidations in epochs i+1, ..., i+j.
    vm.assume(user1 != user2);
    vm.assume(fuzzHelper.isAllowed(user1));
    vm.assume(fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(10_000_000));
    fundAddress(user2, usdcVal(10_000_000));

    // EPOCH 1
    // usdcAvailable = $3600, fiduRequested = 3500
    depositToSpFrom(user1, usdcVal(4000));
    // Invest in a pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);
    uint256 token1 = requestWithdrawalFrom(user1, fiduVal(3500));
    depositToSpFrom(user2, usdcVal(3600)); // User 2's deposit allows User 1 to fully liquidate

    // EPOCH 2
    // usdcAvailable = $100 + $500 = 600, fiduRequested = 1000 (all from user2)
    vm.warp(block.timestamp + sp.epochDuration());
    uint256 token2 = requestWithdrawalFrom(user2, fiduVal(1000));
    depositToSpFrom(GF_OWNER, usdcVal(500));

    // EPOCH 3
    vm.warp(block.timestamp + sp.epochDuration());
    // Person2 adding to their withdrawal request should not give them any usdcAllocated from epoch2
    addToWithdrawalRequestFrom(user1, fiduVal(500), token1);
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request1 = sp.withdrawalRequest(token1);
    assertEq(request1.usdcWithdrawable, usdcVal(3500));
    assertEq(request1.fiduRequested, fiduVal(500));
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request2 = sp.withdrawalRequest(token2);
    assertEq(request2.usdcWithdrawable, usdcVal(600));
    assertEq(request2.fiduRequested, fiduVal(400));
    assertEq(sp.epochAt(1).fiduRequested, fiduVal(3500));
    assertEq(sp.epochAt(1).usdcAllocated, usdcVal(3500));
    assertEq(sp.epochAt(2).fiduRequested, fiduVal(1000));
    assertEq(sp.epochAt(2).usdcAllocated, usdcVal(600));
  }

  /*================================================================================
  Cancel Withdrawal Request Access Control tests
  ================================================================================*/

  function testCancelWithdrawalRequestEoaGoListedWorks(address user, uint256 depositAmount)
    public
    onlyAllowListed(user)
    goListed(user)
  {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    assertEq(requestTokens.balanceOf(user), 1);
    cancelWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testCancelWithdrawalRequestEoaValidUidWorks(
    address user,
    uint256 depositAmount,
    uint256 validUid
  ) public onlyAllowListed(user) {
    validUid = bound(validUid, 1, 4);
    vm.assume(validUid != 2);
    mintUid(user, validUid, 1, "");
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    assertEq(requestTokens.balanceOf(user), 1);
    cancelWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testCancelWithdrawalRequestEoaInvalidUidReverts(
    address user,
    uint256 depositAmount,
    uint256 invalidUid
  ) public onlyAllowListed(user) {
    invalidUid = bound(invalidUid, 5, type(uint256).max);
    mintUid(user, 1, 1, "");
    mintUid(user, invalidUid, 1, "");
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    burnUid(user, 1);
    vm.expectRevert(bytes("NA"));
    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestRevertsWhenEoaHasNoUidOrGoList(address user, uint256 depositAmount)
    public
    onlyAllowListed(user)
  {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, depositAmount);

    uint256 depositShares = depositToSpFrom(user, depositAmount);

    uint256 tokenId = requestWithdrawalFrom(user, depositShares);

    removeFromGoList(user);
    vm.expectRevert(bytes("NA"));
    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestRevertsWhenCallerIsNotTokenOwner(
    address depositor,
    uint256 depositAmount,
    address otherUser
  ) public onlyAllowListed(depositor) onlyAllowListed(otherUser) goListed(depositor) goListed(otherUser) {
    vm.assume(depositor != otherUser);
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(depositor);
    fundAddress(depositor, depositAmount);

    uint256 depositShares = depositToSpFrom(depositor, depositAmount);
    uint256 tokenId = requestWithdrawalFrom(depositor, depositShares);

    vm.expectRevert(bytes("NA"));
    cancelWithdrawalRequestFrom(otherUser, tokenId);
  }

  function testCancelWithdrawalRequestWorksWhenOriginIsGoListedAndCallerHasNothing(uint256 depositAmount) public {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    fundAddress(address(caller), depositAmount);

    uint256 depositShares = caller.deposit(depositAmount);
    uint256 tokenId = caller.requestWithdrawal(depositShares);

    assertEq(requestTokens.balanceOf(address(caller)), 1);
    caller.cancelWithdrawalRequest(tokenId);
    assertZero(requestTokens.balanceOf(address(caller)));
  }

  /*================================================================================
  Cancel Withdrawal Request Tests
  ================================================================================*/

  function testCancelWithdrawalRequestBurnsNftWhenUsdcWithdrawableIsZero(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);
    depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(requestTokens.balanceOf(user), tokenId);
    cancelWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testCancelWithdrawalRequestDoesntBurnNftWhenUsdcWithdrawableGtZero(address user)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, sp.getNumShares(amount));
    assertEq(requestTokens.balanceOf(user), tokenId);

    vm.warp(block.timestamp + sp.epochDuration());

    cancelWithdrawalRequestFrom(user, tokenId);
    assertEq(requestTokens.balanceOf(user), 1);
    assertEq(sp.withdrawalRequest(tokenId).usdcWithdrawable, usdcVal(400));
  }

  function testCancelWithdrawalRequestEmitsReserveSharesCollected(address user)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // Invest in a tranched pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Deposit so the requestor is able to partially liquidate
    depositToSpFrom(GF_OWNER, usdcVal(100));

    vm.warp(block.timestamp + sp.epochDuration());

    uint256 canceledShares = sp.getNumShares(usdcVal(300));
    uint256 treasuryShares = cancelationFee(canceledShares);

    vm.expectEmit(true, false, false, true);
    emit ReserveSharesCollected(user, treasuryShares);

    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestEmitsWithdrawalCanceled(address user)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // Invest in a tranched pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Deposit so the requestor is able to partially liquidate
    depositToSpFrom(GF_OWNER, usdcVal(100));

    vm.warp(block.timestamp + sp.epochDuration());

    vm.expectEmit(true, true, false, true, address(sp));
    uint256 canceledShares = sp.getNumShares(usdcVal(300));
    uint256 treasuryShares = cancelationFee(canceledShares);
    uint256 userShares = canceledShares - treasuryShares;
    emit WithdrawalCanceled(2, user, userShares, treasuryShares);

    cancelWithdrawalRequestFrom(user, tokenId);
  }

  function testCancelWithdrawalRequestInAnEpochAfterTheRequestWasMadeWorks(address user)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    uint256 amount = usdcVal(400);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // Invest in a tranched pool to suck up liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Deposit so the requestor is able to partially liquidate
    depositToSpFrom(GF_OWNER, usdcVal(100));

    vm.warp(block.timestamp + sp.epochDuration());

    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, fiduVal(300));
    assertEq(sp.withdrawalRequest(tokenId).usdcWithdrawable, usdcVal(100));

    uint256 userBalanceBefore = fidu.balanceOf(address(user));
    uint256 treasuryBalanceBefore = fidu.balanceOf(address(TREASURY));

    cancelWithdrawalRequestFrom(user, tokenId);

    uint256 reserveFidu = cancelationFee(fiduVal(300));
    uint256 userFidu = fiduVal(300) - reserveFidu;
    assertZero(fidu.balanceOf(address(sp)));
    assertEq(fidu.balanceOf(address(user)), userBalanceBefore + userFidu);
    assertEq(fidu.balanceOf(TREASURY), treasuryBalanceBefore + reserveFidu);
    assertZero(sp.withdrawalRequest(tokenId).fiduRequested);
    assertEq(sp.withdrawalRequest(tokenId).usdcWithdrawable, usdcVal(100));
    assertEq(requestTokens.balanceOf(user), 1);
    assertZero(sp.epochAt(2).fiduRequested);
  }

  function testCancelWithdrawalRequestInTheSameEpochTheRequestWasMadeWorks(
    address user1,
    address user2,
    uint256 depositAmount1,
    uint256 depositAmount2
  ) public {
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    depositAmount1 = bound(depositAmount1, usdcVal(1), usdcVal(10_000_000));
    depositAmount2 = bound(depositAmount2, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, depositAmount1);
    fundAddress(user2, depositAmount2);

    depositToSpFrom(user1, depositAmount1);
    depositToSpFrom(user2, depositAmount2);
    requestWithdrawalFrom(user1, sp.getNumShares(depositAmount1));
    requestWithdrawalFrom(user2, sp.getNumShares(depositAmount2));

    uint256 spFiduBefore = fidu.balanceOf(address(sp));
    uint256 userBalanceBefore = fidu.balanceOf(address(user1));
    uint256 treasuryBalanceBefore = fidu.balanceOf(address(TREASURY));
    ISeniorPoolEpochWithdrawals.Epoch memory epoch = sp.epochAt(1);

    // First user cancels their request
    cancelWithdrawalRequestFrom(user1, 1);
    uint256 reserveFidu = cancelationFee(sp.getNumShares(depositAmount1));
    uint256 userFidu = sp.getNumShares(depositAmount1) - reserveFidu;
    assertEq(fidu.balanceOf(address(sp)), spFiduBefore - (userFidu + reserveFidu));
    assertEq(fidu.balanceOf(address(user1)), userBalanceBefore + userFidu);
    assertEq(fidu.balanceOf(TREASURY), treasuryBalanceBefore + reserveFidu);
    assertZero(requestTokens.balanceOf(user1));
    // Epoch 1's fiduRequested should no longer include user 1's fidu
    assertEq(sp.epochAt(1).fiduRequested, epoch.fiduRequested - (userFidu + reserveFidu));
    // Request info is empty
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);

    spFiduBefore = fidu.balanceOf(address(sp));
    userBalanceBefore = fidu.balanceOf(address(user2));
    treasuryBalanceBefore = fidu.balanceOf(address(TREASURY));
    epoch = sp.epochAt(1);

    // Second user cancels their request
    cancelWithdrawalRequestFrom(user2, 2);
    reserveFidu = cancelationFee(sp.getNumShares(depositAmount2));
    userFidu = sp.getNumShares(depositAmount2) - reserveFidu;
    assertEq(fidu.balanceOf(address(sp)), spFiduBefore - (userFidu + reserveFidu));
    assertEq(fidu.balanceOf(address(user2)), userBalanceBefore + userFidu);
    assertEq(fidu.balanceOf(TREASURY), treasuryBalanceBefore + reserveFidu);
    assertZero(requestTokens.balanceOf(user2));
    // Epoch 1's fiduRequested should be 0
    assertZero(sp.epochAt(1).fiduRequested);
    // Request info is empty
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(2);
  }

  /*================================================================================
  withdrawalRequest view tests
  ================================================================================*/

  function testWithdrawalRequestReturnsCorrectFiduRequestedAndUsdcWithdrawable(address user1, address user2) public {
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, fiduVal(1000));
    requestWithdrawalFrom(user2, fiduVal(3000));

    // Invest in a tranched pool to suck up the $4000 liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);
    assertZero(sp.usdcAvailable());

    // Make a $500 deposit in epoch 1
    depositToSpFrom(GF_OWNER, usdcVal(500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Make a $350 deposit
    depositToSpFrom(GF_OWNER, usdcVal(350));

    vm.warp(block.timestamp + sp.epochDuration());

    // In epoch 1 we had $500/$4000 fulfilled = 12.5%
    // In epoch 2 we had $350/$3500 fulfilled = 10%

    // Do user 1
    uint256 usdcEpoch1 = (usdcVal(1000) * 125) / 1000;
    uint256 usdcEpoch2 = ((usdcVal(1000) - usdcEpoch1) * 10) / 100;
    uint256 fiduEpoch1 = (fiduVal(1000) * 125) / 1000;
    uint256 fiduEpoch2 = ((fiduVal(1000) - fiduEpoch1) * 10) / 100;
    assertEq(sp.withdrawalRequest(1).usdcWithdrawable, usdcEpoch1 + usdcEpoch2);
    assertEq(sp.withdrawalRequest(1).fiduRequested, fiduVal(1000) - fiduEpoch1 - fiduEpoch2);

    // Do user 2
    usdcEpoch1 = (usdcVal(3000) * 125) / 1000;
    usdcEpoch2 = ((usdcVal(3000) - usdcEpoch1) * 10) / 100;
    fiduEpoch1 = (fiduVal(3000) * 125) / 1000;
    fiduEpoch2 = ((fiduVal(3000) - fiduEpoch1) * 10) / 100;
    assertEq(sp.withdrawalRequest(2).usdcWithdrawable, usdcEpoch1 + usdcEpoch2);
    assertEq(sp.withdrawalRequest(2).fiduRequested, fiduVal(3000) - fiduEpoch1 - fiduEpoch2);
  }

  /*================================================================================
  currentEpoch
  ================================================================================*/

  function testCurrentEpochReturnsCurrentEpoch() public {
    assertZero(sp.currentEpoch().fiduRequested);
    assertZero(sp.currentEpoch().fiduLiquidated);
    assertZero(sp.currentEpoch().usdcAllocated);

    uint256 shares = depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 token = requestWithdrawalFrom(GF_OWNER, shares / 2);

    assertEq(sp.currentEpoch().fiduRequested, shares / 2, "1");
    assertZero(sp.currentEpoch().fiduLiquidated, "2");
    assertZero(sp.currentEpoch().usdcAllocated, "3");

    uint256 oldEndsAt = sp.currentEpoch().endsAt;
    vm.warp(block.timestamp + sp.epochDuration());

    assertZero(sp.currentEpoch().fiduRequested);
    assertZero(sp.currentEpoch().fiduLiquidated);
    assertZero(sp.currentEpoch().usdcAllocated);
    assertEq(sp.currentEpoch().endsAt, oldEndsAt + sp.epochDuration());
  }

  /*================================================================================
  Claim Withdrawal Request Access Control Tests
  ================================================================================*/

  function testClaimWithdrawalEoaWorksGoListed(address user) public {
    vm.assume(fuzzHelper.isAllowed(user));
    approveTokensMaxAmount(user);
    addToGoList(user);
    fundAddress(user, usdcVal(4000));

    uint256 shares = depositToSpFrom(user, usdcVal(4000));

    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    claimWithdrawalRequestFrom(user, tokenId);
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
  }

  function testClaimWithdrawalEoaWorksWithValidUid(address user, uint256 uidType) public {
    vm.assume(fuzzHelper.isAllowed(user));
    uidType = bound(uidType, 1, 4);
    vm.assume(uidType != 2);

    approveTokensMaxAmount(user);
    mintUid(user, uidType, 1, "");
    assertEq(uniqueIdentity.balanceOf(user, uidType), 1);
    fundAddress(user, usdcVal(4000));

    uint256 shares = depositToSpFrom(user, usdcVal(4000));
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    claimWithdrawalRequestFrom(user, tokenId);
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
  }

  function testClaimWithdrawalRevertsForInvalidUid(address user, uint256 invalidUidType) public onlyAllowListed(user) {
    invalidUidType = bound(invalidUidType, 5, type(uint256).max);
    approveTokensMaxAmount(user);
    mintUid(user, 1, 1, "");
    fundAddress(user, usdcVal(4000));

    uint256 shares = depositToSpFrom(user, usdcVal(4000));
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    burnUid(user, 1);
    mintUid(user, invalidUidType, 1, "");

    vm.expectRevert(bytes("NA"));
    claimWithdrawalRequestFrom(user, tokenId);
  }

  function testClaimWithdrawalRevertsForNoUidAndNoGoList(address user) public onlyAllowListed(user) {
    approveTokensMaxAmount(user);
    mintUid(user, 1, 1, "");
    fundAddress(user, usdcVal(4000));
    uint256 shares = depositToSpFrom(user, usdcVal(4000));
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    burnUid(user, 1);

    vm.expectRevert(bytes("NA"));
    claimWithdrawalRequestFrom(user, tokenId);
  }

  function testClaimWithdrawalWorksWhenOriginHasNothingAndCallerIsGoListed() public {
    TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
    addToGoList(address(caller));
    fundAddress(address(caller), usdcVal(4000));
    caller.deposit(usdcVal(4000));
    uint256 shares = sp.getNumShares(usdcVal(4000));
    uint256 tokenId = caller.requestWithdrawal(shares);

    vm.warp(block.timestamp + sp.epochDuration());

    caller.claimWithdrawalRequest(tokenId);
    assertZero(requestTokens.balanceOf(address(caller)));
  }

  /*================================================================================
  Claim Withdrawal Request Tests
  ================================================================================*/

  function testClaimWithdrawalRequestNoOpsOnEarlyWithdrawal(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
  {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    uint256 userUsdcBefore = usdc.balanceOf(user);
    uint256 spUsdcBefore = usdc.balanceOf(address(sp));
    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory request = sp.withdrawalRequest(tokenId);

    claimWithdrawalRequestFrom(user, tokenId);

    assertEq(usdc.balanceOf(user), userUsdcBefore);
    assertEq(usdc.balanceOf(address(sp)), spUsdcBefore);
    assertEq(sp.withdrawalRequest(tokenId).epochCursor, request.epochCursor);
    assertEq(sp.withdrawalRequest(tokenId).fiduRequested, request.fiduRequested);
    assertEq(sp.withdrawalRequest(tokenId).usdcWithdrawable, request.usdcWithdrawable);
  }

  function testClaimWithdrawalRequestBurnsNftWhenAllFiduIsLiquidated(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
  {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    approveTokensMaxAmount(user);
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    // No usdc outflows, so request will be fully liquidated by the next epoch
    vm.warp(block.timestamp + sp.epochDuration());

    assertEq(requestTokens.balanceOf(user), 1);
    claimWithdrawalRequestFrom(user, tokenId);
    assertZero(requestTokens.balanceOf(user));
  }

  function testClaimWithdrawalRequestWithdrawsUpToTheCurrentEpoch(address user1, address user2) public {
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    // Use a TP to suck up all liquidity
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Epoch 1
    depositToSpFrom(GF_OWNER, usdcVal(500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 2
    depositToSpFrom(GF_OWNER, usdcVal(350));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 3
    depositToSpFrom(GF_OWNER, usdcVal(1000));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 4
    // In Epoch 1 we had $500 in and $4000 requested, so 12.5% fulfilled
    // In Epoch 2 we had $350 in and $3500 requested, so 10% fulfilled
    // In Epoch 3 we had $1000 in and $3150 requested, so 31.746031746% fulfilled
    uint256 usdcEpoch1 = (usdcVal(1000) * 125) / 1000;
    uint256 fiduEpoch1 = (fiduVal(1000) * 125) / 1000;
    uint256 usdcEpoch2 = (usdcVal(1000) - usdcEpoch1) / 10;
    uint256 fiduEpoch2 = (fiduVal(1000) - fiduEpoch1) / 10;
    uint256 usdcEpoch3 = ((usdcVal(1000) - usdcEpoch2 - usdcEpoch1) * 31_746_031_746) / 100_000_000_000;
    uint256 fiduEpoch3 = ((fiduVal(1000) - fiduEpoch2 - fiduEpoch1) * 31_746_031_746) / 100_000_000_000;
    uint256 usdcWithdrawable = usdcEpoch1 + usdcEpoch2 + usdcEpoch3;
    uint256 fiduLiquidated = fiduEpoch1 + fiduEpoch2 + fiduEpoch3;
    uint256 userUsdcBefore = usdc.balanceOf(address(user1));

    claimWithdrawalRequestFrom(user1, 1);

    assertApproxEqAbs(usdc.balanceOf(address(sp)), usdcVal(1850) - usdcWithdrawable, thresholdUsdc());
    assertApproxEqAbs(usdc.balanceOf(TREASURY), withdrawalFee(usdcWithdrawable), thresholdUsdc());
    assertEq(usdc.balanceOf(user1), userUsdcBefore + withdrawalAmountLessFees(usdcWithdrawable));
    assertApproxEqAbs(sp.withdrawalRequest(1).fiduRequested, fiduVal(1000) - fiduLiquidated, thresholdFidu());
    assertZero(sp.withdrawalRequest(1).usdcWithdrawable);
    assertEq(sp.withdrawalRequest(1).epochCursor, 4);

    usdcEpoch1 = (usdcVal(3000) * 125) / 1000;
    fiduEpoch1 = (fiduVal(3000) * 125) / 1000;
    usdcEpoch2 = (usdcVal(3000) - usdcEpoch1) / 10;
    fiduEpoch2 = (fiduVal(3000) - fiduEpoch1) / 10;
    usdcEpoch3 = ((usdcVal(3000) - usdcEpoch2 - usdcEpoch1) * 31_746_031_746) / 100_000_000_000;
    fiduEpoch3 = ((fiduVal(3000) - fiduEpoch2 - fiduEpoch1) * 31_746_031_746) / 100_000_000_000;
    usdcWithdrawable = usdcEpoch1 + usdcEpoch2 + usdcEpoch3;
    fiduLiquidated = fiduEpoch1 + fiduEpoch2 + fiduEpoch3;
    userUsdcBefore = usdc.balanceOf(address(user2));

    {
      uint256 spUsdcBefore = usdc.balanceOf(address(sp));
      uint256 treasuryUsdcBefore = usdc.balanceOf(address(TREASURY));
      claimWithdrawalRequestFrom(user2, 2);

      assertApproxEqAbs(usdc.balanceOf(address(sp)), spUsdcBefore - usdcWithdrawable, thresholdUsdc());
      assertApproxEqAbs(
        usdc.balanceOf(TREASURY),
        treasuryUsdcBefore + withdrawalFee(usdcWithdrawable),
        thresholdUsdc()
      );
      assertEq(usdc.balanceOf(user2), userUsdcBefore + withdrawalAmountLessFees(usdcWithdrawable));
      assertApproxEqAbs(sp.withdrawalRequest(2).fiduRequested, fiduVal(3000) - fiduLiquidated, thresholdFidu());
      assertZero(sp.withdrawalRequest(2).usdcWithdrawable);
      assertEq(sp.withdrawalRequest(2).epochCursor, 4);
    }
  }

  function testClaimWithdrawalShouldClearMyPositionWhenClearingInThePast(address user1, address user2) public {
    (TestTranchedPool tp, ) = defaultTp();
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    // Use a TP to suck up all liquidity
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    // Epoch 1
    depositToSpFrom(GF_OWNER, usdcVal(500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 2
    depositToSpFrom(GF_OWNER, usdcVal(1500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 3
    depositToSpFrom(GF_OWNER, usdcVal(2500));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 4
    // This deposit will fully liquidate requests
    depositToSpFrom(GF_OWNER, usdcVal(10_000));

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 5
    claimWithdrawalRequestFrom(user1, 1);
    claimWithdrawalRequestFrom(user2, 2);

    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(2);
    assertZero(requestTokens.balanceOf(user1));
    assertZero(requestTokens.balanceOf(user2));

    assertEq(usdc.balanceOf(user1), withdrawalAmountLessFees(usdcVal(1000)));
    assertEq(usdc.balanceOf(user2), withdrawalAmountLessFees(usdcVal(3000)));
    assertEq(usdc.balanceOf(TREASURY), withdrawalFee(usdcVal(4000)));

    assertEq(sp.usdcAvailable(), usdcVal(10_500));
  }

  function testClaimWithdrawalClearsMyPositionWhenThereIsEnoughLiquidity(address user, uint256 amount) public {
    vm.assume(fuzzHelper.isAllowed(user));
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    addToGoList(user);
    approveTokensMaxAmount(user);
    fundAddress(user, amount);

    uint256 shares = depositToSpFrom(user, amount);
    uint256 tokenId = requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration());

    claimWithdrawalRequestFrom(user, tokenId);

    vm.expectRevert("ERC721: owner query for nonexistent token");
    sp.withdrawalRequest(1);
    assertZero(requestTokens.balanceOf(user));
  }

  function testClaimWithdrawalUsesTheSharePriceFromEachEpochToDetermineFiduLiquidated(address user1, address user2)
    public
  {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    // Use a TP to suck up all liquidity
    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    uint256 poolToken = sp.invest(tp);

    drawdownTp(usdcVal(5000), tp);

    // $500 deposit in epoch 1, share price = 1.00
    depositToSpFrom(GF_OWNER, usdcVal(500));

    // Epoch 3, when first tp payment is due. Pay and redeem
    vm.warp(block.timestamp + 1 + 30 days);
    tp.assess();
    payTp(cl.interestOwed(), tp);
    // Make a deposit such that inflows for this epoch total $200
    depositToSpFrom(GF_OWNER, usdcVal(200) - poolTokens.getTokenInfo(poolToken).interestRedeemed);

    vm.warp(block.timestamp + sp.epochDuration());

    // Epoch 4
    // Epoch 1
    //    sharePrice = 1000000000000000000
    //    usdcIn = $500
    //    epochFidu = 4000
    //    user1TotalFidu = 1000
    //    user1Usdc = $500 * 1000/4000 = $125
    //    user1Fidu = $125/1.00 = 125
    // Epoch 2 0 inflows
    // Epoch 3
    //    sharePrice = 1002876712250000000
    //    usdcIn = $200
    //    epochFidu = 3500
    //    user1TotalFidu = 875
    //    user1Usdc = $200 * 875/3500 = $50
    //    user1Fidu = $50/1.002876712250000000 = $49.856576974275036
    uint256 usdcEpoch1 = usdcVal(125);
    uint256 usdcEpoch3 = usdcVal(50);
    uint256 usdcWithdrawable = usdcEpoch1 + usdcEpoch3;
    uint256 fiduEpoch1 = fiduVal(125);
    uint256 fiduEpoch3 = sp.__getNumShares(usdcVal(50), sp.sharePrice());
    uint256 fiduLiquidated = fiduEpoch1 + fiduEpoch3;

    assertEq(sp.withdrawalRequest(1).usdcWithdrawable, usdcWithdrawable);

    claimWithdrawalRequestFrom(user1, 1);

    assertEq(usdc.balanceOf(user1), withdrawalAmountLessFees(usdcWithdrawable));
    assertEq(sp.withdrawalRequest(1).fiduRequested, fiduVal(1000) - fiduLiquidated);
    assertZero(sp.withdrawalRequest(1).usdcWithdrawable);

    usdcEpoch1 = usdcVal(375);
    usdcEpoch3 = usdcVal(150);
    usdcWithdrawable = usdcEpoch1 + usdcEpoch3;
    fiduEpoch1 = fiduVal(375);
    fiduEpoch3 = sp.__getNumShares(usdcVal(150), sp.sharePrice());
    fiduLiquidated = fiduEpoch1 + fiduEpoch3;

    assertEq(sp.withdrawalRequest(2).usdcWithdrawable, usdcWithdrawable);

    claimWithdrawalRequestFrom(user2, 2);

    assertEq(usdc.balanceOf(user2), withdrawalAmountLessFees(usdcWithdrawable));
    assertEq(sp.withdrawalRequest(2).fiduRequested, fiduVal(3000) - fiduLiquidated);
    assertZero(sp.withdrawalRequest(2).usdcWithdrawable);
  }

  /**
    This function simulates a user waiting many epochs before claiming their request. We want to make sure
    that claiming is not prohibitively expensive, even if they wait a long time.
   */
  function testClaimWithdrawalRequestAfterLongTimeIsNotTooExpensive(address user1, address user2) public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    vm.assume(user1 != user2 && fuzzHelper.isAllowed(user1) && fuzzHelper.isAllowed(user2));
    addToGoList(user1);
    addToGoList(user2);
    approveTokensMaxAmount(user1);
    approveTokensMaxAmount(user2);
    fundAddress(user1, usdcVal(1000));
    fundAddress(user2, usdcVal(3000));

    depositToSpFrom(user1, usdcVal(1000));
    depositToSpFrom(user2, usdcVal(3000));

    uint256 token1 = requestWithdrawalFrom(user1, sp.getNumShares(usdcVal(1000)));
    requestWithdrawalFrom(user2, sp.getNumShares(usdcVal(3000)));

    depositToTpFrom(GF_OWNER, usdcVal(1000), tp);
    lockJuniorCap(tp);
    sp.invest(tp);

    drawdownTp(usdcVal(5000), tp);

    // EPOCH 1 - senior pool deposit
    depositToSpFrom(GF_OWNER, usdcVal(1000));

    // EPOCH 2 - senior pool deposit
    vm.warp(block.timestamp + 14 days);
    depositToSpFrom(GF_OWNER, usdcVal(1000));

    // EPOCH 3 - tranched pool repayment
    vm.warp(block.timestamp + 17 days);
    tp.assess();
    assertTrue(cl.interestOwed() > 0);
    payTp(cl.interestOwed(), tp);
    assertZero(cl.interestOwed());

    // EPOCH 4 - senior pool deposit
    vm.warp(block.timestamp + 14 days);
    depositToSpFrom(GF_OWNER, usdcVal(500));

    // EPOCH 5 - tranched pool repayment
    vm.warp(block.timestamp + 17 days);
    tp.assess();
    assertTrue(cl.interestOwed() > 0, "Has interest owed");
    payTp(cl.interestOwed(), tp);
    assertZero(cl.interestOwed(), "No more interest owed");

    // EPOCH 6 - claim withdrawal request
    vm.warp(block.timestamp + 14 days);
    // small deposit to trigger epoch checkpoint
    depositToSpFrom(GF_OWNER, usdcVal(1));

    uint256 gasBeforeClaim = gasleft();
    claimWithdrawalRequestFrom(user1, token1);
    uint256 gasUsedApprox = gasBeforeClaim - gasleft();

    /*
    At current gas price (Nov 27 2022)
    * Gas consumed is 128442
    * Gas fee is 13.38 gwei
    * ETH is $1177.03
    * Cost is 13.38 gwei * 128442 = 0.002204 ETH = $2.59
    */
    assertTrue(gasUsedApprox < 130_000);
  }

  /*================================================================================
  Pool Assets 
  ================================================================================*/

  function testPoolAssetsDoesntIncludeUsdcAllocatedFroWithdrawals(address user, uint256 amount)
    public
    onlyAllowListed(user)
    goListed(user)
    tokenApproved(user)
  {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user, amount);
    uint256 shares = depositToSpFrom(user, amount);
    requestWithdrawalFrom(user, shares);
    assertEq(sp.assets(), amount);
    vm.warp(block.timestamp + sp.epochDuration());
    assertZero(sp.assets());
  }

  function testPoolAssetsDoesntDecreaseOnClaimWithdrawalRequest(
    address user1,
    address user2,
    uint256 amount1,
    uint256 amount2
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
    amount1 = bound(amount1, usdcVal(1), usdcVal(10_000_000));
    amount2 = bound(amount2, usdcVal(1), usdcVal(10_000_000));
    fundAddress(user1, amount1);
    fundAddress(user2, amount2);
    uint256 shares1 = depositToSpFrom(user1, amount1);
    uint256 token1 = requestWithdrawalFrom(user1, shares1);
    assertEq(sp.assets(), amount1);
    vm.warp(block.timestamp + sp.epochDuration());
    uint256 shares2 = depositToSpFrom(user2, amount2);
    requestWithdrawalFrom(user2, shares2);
    assertEq(sp.assets(), amount2);
    claimWithdrawalRequestFrom(user1, token1);
    // Assets should be unchanged even after user1 takes their usdc allocated out
    assertEq(sp.assets(), amount2);
  }

  /*================================================================================
  Shares Outstanding 
  ================================================================================*/

  function testSharesOutstandingIncludesNewlyMintedFidu(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    assertZero(sp.sharesOutstanding());
    uint256 shares = depositToSpFrom(GF_OWNER, amount);
    assertEq(sp.sharesOutstanding(), shares);
  }

  function testSharesOustandingExcludesVirtuallyBurnedFidu(uint256 amount) public {
    amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
    uint256 shares = depositToSpFrom(GF_OWNER, amount);
    assertEq(sp.sharesOutstanding(), shares);
    requestWithdrawalFrom(GF_OWNER, shares);
    assertEq(sp.sharesOutstanding(), shares);
    vm.warp(block.timestamp + sp.epochDuration());
    // Although FIDU hasn't actually been burned yet it should be excluded from shares outstanding
    assertZero(sp.sharesOutstanding());
  }

  /*================================================================================
  Assets Matching Liabilities
  ================================================================================*/

  function testAssetLiabilityMismatchShouldPreventNewFiduMintsWhenMismatchExceedsThreshold() public {
    // TODO - fuzzed inputs
    depositToSpFrom(GF_OWNER, usdcVal(1));
    // Difference in share price must be enough to exceed the asset/liability mismatch threshold
    sp._setSharePrice(sp.sharePrice() * 3);
    vm.expectRevert("Cannot mint: it would create an asset/liability mismatch");
    depositToSpFrom(GF_OWNER, usdcVal(1));
  }

  function testAssetLiabilityMismatchShouldAllowNewFiduMintsWhenMismatchUnderThreshold() public {
    // TODO - fuzzed inputs
    depositToSpFrom(GF_OWNER, usdcVal(1));
    // This share price will cause a rounding error of 1 atomic unit.
    sp._setSharePrice(uint256(123456789) * uint256(1e8));
    uint256 fiduBefore = fidu.balanceOf(GF_OWNER);
    depositToSpFrom(GF_OWNER, usdcVal(1));
    assertTrue(fidu.balanceOf(GF_OWNER) > fiduBefore);
  }

  /*================================================================================
  Helper functions
  ================================================================================*/

  function testFiduMantissaShouldHave18Decimals() public {
    assertEq(sp.fiduMantissa(), 1e18);
  }

  function testUsdcMantissaShouldHave6Decimals() public {
    assertEq(sp.usdcMantissa(), 1e6);
  }

  function testUsdcToFiduAddsCorrectDecimalsToUsdc(uint256 usdcAmount) public {
    usdcAmount = bound(usdcAmount, usdcVal(1), usdcVal(10_000_000));
    assertEq(sp.usdcToFidu(usdcAmount), usdcAmount * 1e12);
  }

  /*================================================================================
  Estimate Investment
  ================================================================================*/

  function testEstimateInvestmentRevertsForInvalidPool() public {
    TestTranchedPool tp = new TestTranchedPool();
    uint256[] memory ids = new uint256[](1);
    tp.initialize(address(gfConfig), GF_OWNER, 1, 1, 1, 1, 1, 1, 1, block.timestamp, ids);
    vm.expectRevert("Pool must be valid");
    sp.estimateInvestment(tp);
  }

  function testEstimateInvestmentReturnsStrategysInvestmentAmount(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);

    // Should use the 4x leverage strategy
    assertEq(sp.estimateInvestment(tp), 4 * juniorAmount);
  }

  /*================================================================================
  Invest
  ================================================================================*/

  function testInvestRevertsForInvalidPool() public {
    TestTranchedPool tp = new TestTranchedPool();
    uint256[] memory ids = new uint256[](1);
    tp.initialize(address(gfConfig), GF_OWNER, 1, 1, 1, 1, 1, 1, 1, block.timestamp, ids);
    vm.expectRevert("Pool must be valid");
    sp.invest(tp);
  }

  function testInvestCallableByAnyone(uint256 juniorAmount, address user) public {
    (TestTranchedPool tp, ) = defaultTp();
    vm.assume(fuzzHelper.isAllowed(user));
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);

    depositToSpFrom(GF_OWNER, sp.estimateInvestment(tp));

    _startImpersonation(user);
    sp.invest(tp);
    _stopImpersonation();
  }

  function testInvestWorksWhenSeniorTrancheNonEmpty(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    tp._setSeniorTranchePrincipalDeposited(usdcVal(1));
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);

    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    sp.invest(tp);

    assertEq(tp.getTranche((uint256(ITranchedPool.Tranches.Senior))).principalDeposited, investmentAmount + usdcVal(1));
  }

  function testInvestDepositsToSeniorTranche(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);
    sp.invest(tp);
    assertEq(tp.getTranche((uint256(ITranchedPool.Tranches.Senior))).principalDeposited, investmentAmount);
  }

  function testInvestEmitsInvestmentMadeInSeniorEvent(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    vm.expectEmit(true, false, false, true);
    emit InvestmentMadeInSenior(address(tp), investmentAmount);

    sp.invest(tp);
  }

  function testInvestCountsInvestmentAmountInAssets(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    assertEq(sp.usdcAvailable(), investmentAmount);
    assertZero(sp.totalLoansOutstanding());
    assertEq(sp.assets(), investmentAmount);

    sp.invest(tp);

    assertZero(sp.usdcAvailable());
    assertEq(sp.totalLoansOutstanding(), investmentAmount);
    assertEq(sp.assets(), investmentAmount);
  }

  function testInvestRevertsForZeroInvestmentAmount() public {
    (TestTranchedPool tp, ) = defaultTp();
    lockJuniorCap(tp);

    vm.expectRevert("Investment amount must be positive");
    sp.invest(tp);
  }

  function testInvestDecreasesUsdcAvailable(uint256 juniorAmount) public {
    juniorAmount = bound(juniorAmount, usdcVal(1), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    depositToSpFrom(GF_OWNER, investmentAmount);

    assertEq(sp.usdcAvailable(), investmentAmount);
    sp.invest(tp);
    assertZero(sp.usdcAvailable());
  }

  function testInvestLiquidatesEpochIfOneOrMoreEpochsHaveEnded(address user, uint256 epochsElapsed)
    public
    goListed(user)
    tokenApproved(user)
  {
    (TestTranchedPool tp, ) = defaultTp();
    vm.assume(fuzzHelper.isAllowed(user));
    epochsElapsed = bound(epochsElapsed, 1, 10);
    uint256 juniorAmount = usdcVal(100);
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    uint256 investmentShares = depositToSpFrom(GF_OWNER, investmentAmount);

    // Request to take out half
    fundAddress(user, usdcVal(100));
    uint256 shares = depositToSpFrom(user, usdcVal(100));
    requestWithdrawalFrom(user, shares);

    vm.warp(block.timestamp + sp.epochDuration() * epochsElapsed);

    uint256 fiduSupplyBefore = fidu.totalSupply();
    assertEq(fiduSupplyBefore, investmentShares + shares);
    sp.invest(tp);
    // Fidu should have been burned as a result of the liquidation
    assertEq(fidu.totalSupply(), investmentShares);
  }

  function testInvestCannotInvestMoreThanUsdcAvailableEvenIfUsdcBalanceExceedsUsdcAvailable(uint256 juniorAmount)
    public
  {
    juniorAmount = bound(juniorAmount, usdcVal(2), usdcVal(1_000_000));
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, juniorAmount, tp);
    lockJuniorCap(tp);
    uint256 investmentAmount = sp.estimateInvestment(tp);
    uint256 investmentShares = depositToSpFrom(GF_OWNER, investmentAmount);

    // Request to take out half
    requestWithdrawalFrom(GF_OWNER, investmentShares / 2);

    vm.warp(block.timestamp + sp.epochDuration());

    // Half of the investment $ is allocated to the withdrawal request, and the sp no longer has
    // enough usdc available to invest
    assertEq(usdc.balanceOf(address(sp)), investmentAmount);
    assertEq(sp.usdcAvailable(), investmentAmount / 2);

    vm.expectRevert("not enough usdc");
    sp.invest(tp);
  }

  /*================================================================================
  Set epoch duration
  ================================================================================*/

  function testSetEpochDurationCheckpointsElapsedNoOpEpochsCorrectly() public {
    /*
    Currently we have epoch duration of two weeks
    v- week 0(last checkpoint)
    | 2 weeks | 2 weeks | [we are here] 2 weeks | <--- endsAt

    We to make sure that the new endsAt timestamp is based off the endsAt of the previous
    epoch even if hasn't been checkpointed.
    v- week 0 (last checkpoint)
    | 2 weeks | 2 weeks | [we are here]| 5 weeks           | <--- endsAt = week 9
    */
    uint256 initialStartsAt = sp.epochAt(1).endsAt - sp.epochDuration();
    vm.warp(block.timestamp + 30 days);
    _startImpersonation(GF_OWNER);
    sp.setEpochDuration(5 weeks);
    assertEq(sp.epochAt(1).endsAt, initialStartsAt + 9 weeks);
  }

  function testSetEpochDurationCheckpointsElapsedEpochsCorrectly() public {
    // Like the previous test but now that there's a withdrawal request we
    // expect the epoch id to update as well.
    uint256 initialStartsAt = sp.epochAt(1).endsAt - sp.epochDuration();
    uint256 shares = depositToSpFrom(GF_OWNER, usdcVal(1));
    requestWithdrawalFrom(GF_OWNER, shares);
    vm.warp(block.timestamp + 30 days);
    _startImpersonation(GF_OWNER);
    sp.setEpochDuration(5 weeks);
    assertEq(sp.epochAt(2).endsAt, initialStartsAt + 9 weeks);
  }

  function testSetEpochDurationWorksForAdmin(uint256 epochDuration) public impersonating(GF_OWNER) {
    epochDuration = bound(epochDuration, 1 days, 10 weeks);
    vm.assume(epochDuration != sp.epochDuration());
    sp.setEpochDuration(epochDuration);
    assertEq(sp.epochDuration(), epochDuration);
  }

  function testSetEpochDurationReversForNonAdmin(address user) public onlyAllowListed(user) impersonating(user) {
    vm.expectRevert("Must have admin role to perform this action");
    sp.setEpochDuration(1 days);
  }

  function testSetEpochDurationEmitsEpochDurationChanged(uint256 epochDuration) public impersonating(GF_OWNER) {
    epochDuration = bound(epochDuration, 1 days, 10 weeks);
    vm.assume(epochDuration != sp.epochDuration());
    vm.expectEmit(false, false, false, true);
    emit EpochDurationChanged(epochDuration);
    sp.setEpochDuration(epochDuration);
  }

  /*================================================================================
  Epoch duration
  ================================================================================*/

  function testEpochDurationReturnsCorrectDuration() public {
    assertEq(sp.epochDuration(), 2 weeks);
  }

  /*================================================================================
  Redeem
  ================================================================================*/

  function testRedeemRedeemsMaximumFromTranchedPool() public {
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(400));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    vm.warp(tp.creditLine().termEndTime());

    payTp(usdcVal(105), tp);

    uint256 spUsdcBefore = usdc.balanceOf(address(sp));
    uint256 reserveUsdcBefore = usdc.balanceOf(TREASURY);
    IPoolTokens.TokenInfo memory tokenBefore = poolTokens.getTokenInfo(poolToken);

    sp.redeem(poolToken);

    uint256 principalRedeemed = poolTokens.getTokenInfo(poolToken).principalRedeemed - tokenBefore.principalRedeemed;
    // Junior contributed 100$, senior levered by 4x (400$). Total limit 500$. Since
    // everything was paid back, senior can redeem full amount.
    uint256 principalRedeemedExpected = usdcVal(400);
    uint256 interestRedeemed = poolTokens.getTokenInfo(poolToken).interestRedeemed - tokenBefore.interestRedeemed;
    // $5 of interest * (4/5) * (1 - (0.2 + 0.1)) = $2.8 where 0.2 is juniorFeePercent and 0.1 is protocolFee
    uint256 interestRedeemedExpected = usdcVal(2) + (usdcVal(1) / 100) * 80;

    assertEq(principalRedeemed, principalRedeemedExpected);
    assertEq(interestRedeemed, interestRedeemedExpected);
    assertEq(usdc.balanceOf(address(sp)), spUsdcBefore + principalRedeemedExpected + interestRedeemedExpected);
    assertEq(usdc.balanceOf(TREASURY), reserveUsdcBefore);
  }

  function testRedeemShouldAdjustSharePriceBasedOnInterestRedeemed() public {
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(400));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    vm.warp(tp.creditLine().termEndTime());

    payTp(usdcVal(105), tp);

    uint256 sharePriceBefore = sp.sharePrice();
    IPoolTokens.TokenInfo memory tokenBefore = poolTokens.getTokenInfo(poolToken);

    sp.redeem(poolToken);

    uint256 interestRedeemed = poolTokens.getTokenInfo(poolToken).interestRedeemed - tokenBefore.interestRedeemed;
    uint256 sharePriceExpected = (((interestRedeemed * sp.fiduMantissa()) / sp.usdcMantissa()) * sp.fiduMantissa()) /
      fidu.totalSupply() +
      sharePriceBefore;

    assertTrue(sp.sharePrice() > sharePriceBefore);
    assertEq(sp.sharePrice(), sharePriceExpected);
  }

  function testRedeemEmitsInterestPrincipalCollected() public {
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(400));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    vm.warp(tp.creditLine().termEndTime());

    payTp(usdcVal(105), tp);

    // $5 of interest * (4/5) * (1 - (0.2 + 0.1)) = $2.8 where 0.2 is juniorFeePercent and 0.1 is protocolFee
    uint256 interestRedeemedExpected = usdcVal(2) + (usdcVal(1) / 100) * 80;
    vm.expectEmit(true, false, false, true);
    emit InterestCollected(address(tp), interestRedeemedExpected);

    // Junior contributed 100$, senior levered by 4x (400$). Total limit 500$. Since
    // everything was paid back, senior can redeem full amount.
    uint256 principalRedeemedExpected = usdcVal(400);
    vm.expectEmit(true, false, false, true);
    emit PrincipalCollected(address(tp), principalRedeemedExpected);

    sp.redeem(poolToken);
  }

  function testRedeemIncreasesUsdcAvailableByAmountRedeemed() public {
    (TestTranchedPool tp, ) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(400));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    vm.warp(tp.creditLine().termEndTime());

    payTp(usdcVal(105), tp);

    // $5 of interest * (4/5) * (1 - (0.2 + 0.1)) = $2.8 where 0.2 is juniorFeePercent and 0.1 is protocolFee
    uint256 interestRedeemedExpected = usdcVal(2) + (usdcVal(1) / 100) * 80;
    // Junior contributed 100$, senior levered by 4x (400$). Total limit 500$. Since
    // everything was paid back, senior can redeem full amount.
    uint256 principalRedeemedExpected = usdcVal(400);

    uint256 usdcAvailableBefore = sp.usdcAvailable();
    sp.redeem(poolToken);

    assertEq(sp.usdcAvailable(), usdcAvailableBefore + interestRedeemedExpected + principalRedeemedExpected);
  }

  /*================================================================================
  Writedown
  ================================================================================*/

  function testWritedownCallableByNonGovernance(address user) public goListed(user) impersonating(user) {
    (TestTranchedPool tp, ) = defaultTp();
    vm.assume(fuzzHelper.isAllowed(user));
    depositToTpFrom(GF_OWNER, usdcVal(100), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(400));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);
    // This should not revert
    sp.writedown(poolToken);
  }

  function testWritedownBeforeLoanEndsWritesDownPrincipalAndDistributesLosses() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204
    uint256 assetsBefore = sp.assets();
    uint256 sharePriceBefore = sp.sharePrice();
    uint256 totalSharesBefore = fidu.totalSupply();

    sp.writedown(poolToken);

    assertApproxEqAbs(sp.totalWritedowns(), expectedWritedown, thresholdUsdc());
    assertApproxEqAbs(sp.assets(), assetsBefore - expectedWritedown, thresholdUsdc());

    uint256 newSharePrice = sp.sharePrice();
    uint256 delta = sharePriceBefore - newSharePrice;
    uint256 normalizedWritedown = sp.usdcToFidu(expectedWritedown);
    uint256 deltaExpected = (normalizedWritedown * sp.fiduMantissa()) / totalSharesBefore;
    assertApproxEqAbs(delta, deltaExpected, thresholdFidu());
    assertTrue(newSharePrice < sharePriceBefore);
    assertApproxEqAbs(newSharePrice, sharePriceBefore - deltaExpected, thresholdFidu());
  }

  function testWritedownShouldDecreaseWritedownAmountForPartialRepayments() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204
    uint256 assetsBefore = sp.assets();
    uint256 originalSharePrice = sp.sharePrice();
    uint256 originalTotalShares = fidu.totalSupply();

    sp.writedown(poolToken);

    uint256 sharePriceAfterFirstwritedown = sp.sharePrice();
    assertApproxEqAbs(sp.totalWritedowns(), expectedWritedown, thresholdUsdc());
    assertApproxEqAbs(sp.assets(), assetsBefore - expectedWritedown, thresholdUsdc());

    // Pay back half of one period
    // tp.assess();
    uint256 interestToPay = cl.interestOwed() / 4; // interestOwed is 2 periods, so 1/4 of that is half-period interest
    uint256 newExpectedWritedown = expectedWritedown / 2;
    payTp(interestToPay, tp);

    sp.writedown(poolToken);

    assertApproxEqAbs(sp.totalWritedowns(), expectedWritedown - newExpectedWritedown, thresholdUsdc());
    assertApproxEqAbs(sp.assets(), assetsBefore - (expectedWritedown - newExpectedWritedown), thresholdUsdc());

    uint256 finalSharePrice = sp.sharePrice();
    uint256 delta = originalSharePrice - finalSharePrice;
    uint256 normalizedWritedown = sp.usdcToFidu(newExpectedWritedown);
    uint256 deltaExpected = (normalizedWritedown * sp.fiduMantissa()) / originalTotalShares;

    assertApproxEqAbs(delta, deltaExpected, thresholdFidu());
    assertTrue(sharePriceAfterFirstwritedown < sp.sharePrice());
    assertApproxEqAbs(sp.sharePrice(), originalSharePrice - deltaExpected, thresholdFidu());
  }

  function testWritedownShouldApplyUsdcInTheCreditLineBeforeWritedown() public {
    // We expect the senior pool to assess the pool before writing it down. This prevents
    // accidentally writing down a pool that has received a payment that is still unapplied

    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    fundAddress(address(cl), usdcVal(100));

    uint256 assetsBefore = sp.assets();
    uint256 writedownsBefore = sp.totalWritedowns();

    sp.writedown(poolToken);

    assertEq(sp.assets(), assetsBefore);
    assertEq(sp.totalWritedowns(), writedownsBefore);
  }

  function testWritedownShouldResetTo0IfFullyPaidBack() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    uint256 sharePriceBefore = sp.sharePrice();
    uint256 assetsBefore = sp.assets();
    uint256 totalWritedownsBefore = sp.totalWritedowns();

    sp.writedown(poolToken);

    assertTrue(sp.sharePrice() < sharePriceBefore);
    assertTrue(sp.assets() < assetsBefore);
    assertTrue(sp.totalWritedowns() > totalWritedownsBefore);
  }

  function testWritedownEmitsEvent() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204
    // We need the actual writedown to test the event emission because the API
    // doesn't allow asserting approximate values in the events.
    int256 actualWritedown = -19999960;

    vm.expectEmit(true, false, false, true);
    emit PrincipalWrittenDown(address(tp), actualWritedown);

    sp.writedown(poolToken);

    assertEq(uint256(actualWritedown * -1), sp.totalWritedowns());
    assertApproxEqAbs(uint256(actualWritedown * -1), expectedWritedown, thresholdUsdc());
  }

  function testWritedownRevertsIfSpNotTokenOwner() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    uint256 juniorToken = depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    vm.expectRevert("Only tokens owned by the senior pool can be written down");
    sp.writedown(juniorToken);
  }

  function testWritedownAfterTermEndTimeShouldHaveDaysLateProportionalToFormula() public {
    // Should be proportional to seconds after termEndTime + totalOwed / totalOwedPerDay
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    vm.warp(cl.termEndTime() + 1);

    sp.writedown(poolToken);
    // We're not yet past the grace period so writedown amount is still zero
    assertZero(sp.totalWritedowns());

    // Advance two payment periods past the term end time
    vm.warp(cl.termEndTime() + 2 * (1 days) * cl.paymentPeriodInDays());

    // 60 days past termEndTime + ~1 days late on
    // (interestOwed + principalOwed) / (interestOwedPerDay and principalOwedPerDay)
    // ~= 61 - 30 / 4 = 26%
    uint256 expectedWritedown = (usdcVal(80) * 26) / 100;
    uint256 assetsBefore = sp.assets();
    sp.writedown(poolToken);

    assertApproxEqAbs(sp.totalWritedowns(), expectedWritedown, 1e17);
    assertApproxEqAbs(sp.assets(), assetsBefore - expectedWritedown, 1e17);
  }

  function testWritedownSharePriceDoesNotAffectFiduLiquidatedInPreviousEpochs() public {
    uint256 shares = depositToSpFrom(GF_OWNER, usdcVal(10_000));
    uint256 requestToken = requestWithdrawalFrom(GF_OWNER, shares);

    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(80));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);
    uint256 sharePriceBefore = sp.sharePrice();

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));
    sp.writedown(poolToken);
    assertTrue(sp.sharePrice() < sharePriceBefore);

    // The fidu should have been liquidated at a share price of 1.00, not the reduced share price, because
    // that liquidation happened in an epoch BEFORE the writedown
    assertEq(sp.withdrawalRequest(requestToken).usdcWithdrawable, usdcVal(10_000));
    assertEq(sp.epochAt(1).fiduLiquidated, fiduVal(10_000));
    assertZero(sp.usdcAvailable());
  }

  /*================================================================================
  Calculate writedown
  ================================================================================*/

  function testCalculateWritedownReturnsWritedownAmount() public {
    (TestTranchedPool tp, CreditLine cl) = defaultTp();
    depositToTpFrom(GF_OWNER, usdcVal(20), tp);
    lockJuniorCap(tp);
    depositToSpFrom(GF_OWNER, usdcVal(100));
    uint256 poolToken = sp.invest(tp);
    lock(tp);
    drawdownTp(usdcVal(100), tp);

    // Two payment periods ahead
    vm.warp(block.timestamp + 1 + 2 * cl.paymentPeriodInDays() * (1 days));
    tp.assess();

    // So writedown is 2 periods late - 1 grace period / 4 max = 25%
    uint256 expectedWritedown = usdcVal(80) / 4; // 25% of 80 = 204

    assertApproxEqAbs(sp.calculateWritedown(poolToken), expectedWritedown, thresholdUsdc());
  }

  // after an epoch ends, users shouldn't immediately have funds withdrawable as soon as they request withdraw
  function testWhenAnEpochCantBeFinalizedAndAMutativeFunctionIsCalledItsExtended() public {
    // unapplied
    depositToSpFrom(GF_OWNER, usdcVal(100));

    uint256 endsAtBeforeWithdrawal = sp.currentEpoch().endsAt;
    vm.warp(endsAtBeforeWithdrawal + 1);

    // extended
    uint256 tokenId = requestWithdrawalFrom(GF_OWNER, fiduVal(100));
    uint256 endsAtAfterWithdrawal = sp.currentEpoch().endsAt;

    assertGt(endsAtAfterWithdrawal, endsAtBeforeWithdrawal);

    ISeniorPoolEpochWithdrawals.WithdrawalRequest memory wr = sp.withdrawalRequest(tokenId);

    assertEq(wr.usdcWithdrawable, 0, "user should not have usdc withdrawable before the next epoch");

    vm.warp(endsAtAfterWithdrawal + 100000);

    wr = sp.withdrawalRequest(tokenId);
    assertGt(wr.usdcWithdrawable, 0);
  }

  // TODO - Uncomment these tests when the Go changes are merged - https://github.com/warbler-labs/mono/pull/800

  // function testAddToWithdrawalRequestRevertsWhenOriginHasValidUidAndCallerHasNothing(
  //   uint256 requestAmount,
  //   uint256 addAmount,
  //   uint256 validUid
  // ) public {
  //   requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
  //   addAmount = bound(addAmount, usdcVal(1), requestAmount);
  //   validUid = bound(validUid, 1, 4);
  //   vm.assume(validUid != 2);
  //   mintUid(address(this), validUid, 1, "");
  //   approveTokensMaxAmount(address(this));
  //   uint256 depositAmount = requestAmount + addAmount;
  //   fundAddress(address(this), depositAmount);
  //   depositToSpFrom(address(this), depositAmount);

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   uint256 depositShares = sp.getNumShares(depositAmount);
  //   fidu.transfer(address(caller), depositShares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
  //   approveForAll(address(this), address(caller), false);
  //   uint256 addAmountShares = sp.getNumShares(addAmount);
  //   vm.expectRevert(bytes("NA"));
  //   caller.addToWithdrawalRequest(addAmountShares, tokenId);
  //   _stopImpersonation();
  // }

  // function testAddToWithdrawalRequestWorksWhenOriginHasValidUidAndCallerIsErc1155Approved(
  //   uint256 requestAmount,
  //   uint256 addAmount,
  //   uint256 validUid
  // ) public {
  //   requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
  //   addAmount = bound(addAmount, usdcVal(1), requestAmount);
  //   validUid = bound(validUid, 1, 4);
  //   vm.assume(validUid != 2);
  //   mintUid(address(this), validUid, 1, "");
  //   approveTokensMaxAmount(address(this));
  //   uint256 depositAmount = requestAmount + addAmount;
  //   fundAddress(address(this), depositAmount);
  //   depositToSpFrom(address(this), depositAmount);

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   uint256 depositShares = sp.getNumShares(depositAmount);
  //   fidu.transfer(address(caller), depositShares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
  //   caller.addToWithdrawalRequest(sp.getNumShares(addAmount), tokenId);
  //   _stopImpersonation();

  //   assertEq(sp.withdrawalRequest(tokenId).fiduRequested, depositShares);
  // }

  // function testAddToWithdrawalRevertsWhenOriginHasInvalidUidAndCallerIsErc1155Approved(
  //   uint256 requestAmount,
  //   uint256 addAmount,
  //   uint256 invalidUid
  // ) public {
  //   requestAmount = bound(requestAmount, usdcVal(1), usdcVal(10_000_000));
  //   addAmount = bound(addAmount, usdcVal(1), requestAmount);
  //   invalidUid = bound(invalidUid, 5, type(uint256).max);
  //   mintUid(address(this), invalidUid, 1, "");
  //   mintUid(address(this), 1, 1, "");
  //   approveTokensMaxAmount(address(this));
  //   uint256 depositAmount = requestAmount + addAmount;
  //   fundAddress(address(this), depositAmount);
  //   depositToSpFrom(address(this), depositAmount);

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   uint256 depositShares = sp.getNumShares(depositAmount);
  //   fidu.transfer(address(caller), depositShares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(requestAmount));
  //   burnUid(address(this), 1);
  //   uint256 addAmountShares = sp.getNumShares(addAmount);
  //   vm.expectRevert(bytes("NA"));
  //   caller.addToWithdrawalRequest(addAmountShares, tokenId);
  // }

  // function testCancelWithdrawalRequestRevertsWhenOriginHAsValidUidAndCallerHasNothing(
  //   uint256 depositAmount,
  //   uint256 validUid
  // ) public {
  //   depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
  //   validUid = bound(validUid, 1, 4);
  //   vm.assume(validUid != 2);
  //   mintUid(address(this), validUid, 1, "");
  //   approveTokensMaxAmount(address(this));
  //   fundAddress(address(this), depositAmount);
  //   uint256 depositShares = depositToSpFrom(address(this), depositAmount);

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   fidu.transfer(address(caller), depositShares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(depositShares);
  //   approveForAll(address(this), address(caller), false);
  //   vm.expectRevert(bytes("NA"));
  //   caller.cancelWithdrawalRequest(tokenId);
  //   _stopImpersonation();
  // }

  // function testCancelWithdrawalRequestWorksWhenOriginHasValidUidAndCallerIsErc1155Approved(
  //   uint256 depositAmount,
  //   uint256 validUid
  // ) public {
  //   depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
  //   validUid = bound(validUid, 1, 4);
  //   vm.assume(validUid != 2);
  //   mintUid(address(this), validUid, 1, "");
  //   approveTokensMaxAmount(address(this));
  //   fundAddress(address(this), depositAmount);
  //   uint256 depositShares = depositToSpFrom(address(this), depositAmount);

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   fidu.transfer(address(caller), depositShares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(depositShares);
  //   caller.cancelWithdrawalRequest(tokenId);
  //   _stopImpersonation();

  //   assertZero(requestTokens.balanceOf(address(caller)));
  // }

  // function testCancelWithdrawalRevertsWhenOriginHasInvalidUidAndCallerIsErc1155Approved(
  //   uint256 depositAmount,
  //   uint256 invalidUid
  // ) public {
  //   depositAmount = bound(depositAmount, usdcVal(1), usdcVal(10_000_000));
  //   invalidUid = bound(invalidUid, 5, type(uint256).max);
  //   mintUid(address(this), invalidUid, 1, "");
  //   mintUid(address(this), 1, 1, "");
  //   approveTokensMaxAmount(address(this));
  //   fundAddress(address(this), depositAmount);
  //   uint256 depositShares = depositToSpFrom(address(this), depositAmount);

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   fidu.transfer(address(caller), depositShares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(sp.getNumShares(depositAmount));
  //   burnUid(address(this), 1);
  //   vm.expectRevert(bytes("NA"));
  //   caller.cancelWithdrawalRequest(tokenId);
  // }

  // function testClaimWithdrawalFailsWhenCallerIsErc1155ApprovedForInvalidUid(uint256 invalidUid) public {
  //   invalidUid = bound(invalidUid, 5, type(uint256).max);
  //   mintUid(address(this), 1, 1, "");
  //   fundAddress(address(this), usdcVal(4000));
  //   approveTokensMaxAmount(address(this));
  //   uint256 shares = depositToSpFrom(address(this), usdcVal(4000));

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   approveTokensMaxAmount(address(caller));

  //   transferFidu(address(this), address(caller), shares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(shares);
  //   _stopImpersonation();

  //   vm.warp(block.timestamp + sp.epochDuration());

  //   burnUid(address(this), 1);
  //   mintUid(address(this), invalidUid, 1, "");

  //   _startImpersonation(address(this), address(this));
  //   vm.expectRevert(bytes("NA"));
  //   caller.claimWithdrawalRequest(tokenId);
  //   _stopImpersonation();
  // }

  // function testClaimWithdrawalFailsWhenOriginHasValidUidButCallerHasNothing(uint256 validUid) public {
  //   validUid = bound(validUid, 1, 4);
  //   vm.assume(validUid != 2);
  //   approveTokensMaxAmount(address(this));
  //   mintUid(address(this), validUid, 1, "");
  //   fundAddress(address(this), usdcVal(4000));
  //   uint256 shares = depositToSpFrom(address(this), usdcVal(4000));

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   approveTokensMaxAmount(address(caller));

  //   transferFidu(address(this), address(caller), shares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(shares);
  //   _stopImpersonation();

  //   vm.warp(block.timestamp + sp.epochDuration());

  //   approveForAll(address(this), address(caller), false);
  //   _startImpersonation(address(this), address(this));
  //   vm.expectRevert(bytes("NA"));
  //   caller.claimWithdrawalRequest(tokenId);
  // }

  // function testClaimWithdrawalSucceedsWhenCallerIsErc1155ApprovedForValidUid(uint256 validUid) public {
  //   validUid = bound(validUid, 1, 4);
  //   vm.assume(validUid != 2);
  //   approveTokensMaxAmount(address(this));
  //   mintUid(address(this), validUid, 1, "");
  //   fundAddress(address(this), usdcVal(4000));
  //   uint256 shares = depositToSpFrom(address(this), usdcVal(4000));

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   approveTokensMaxAmount(address(caller));

  //   transferFidu(address(this), address(caller), shares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 tokenId = caller.requestWithdrawal(shares);
  //   _stopImpersonation();

  //   vm.warp(block.timestamp + sp.epochDuration());

  //   _startImpersonation(address(this), address(this));
  //   caller.claimWithdrawalRequest(tokenId);
  //   _stopImpersonation();

  //   assertZero(sp.withdrawalRequest(1).fiduRequested);
  // }

  // function testRequestWithdrawalSucceedsWhenCallerIsErc1155ApprovedForValidUid(uint256 amount, uint256 validUid)
  //   public
  // {
  //   validUid = bound(validUid, 1, 4);
  //   vm.assume(validUid != 2);
  //   amount = bound(amount, usdcVal(1), usdcVal(10_000_000));
  //   approveTokensMaxAmount(address(this));
  //   mintUid(address(this), validUid, 1, "");
  //   fundAddress(address(this), amount);
  //   depositToSpFrom(address(this), amount);

  //   TestSeniorPoolCaller caller = new TestSeniorPoolCaller(sp, address(usdc), address(fidu));
  //   approveForAll(address(this), address(caller), true);
  //   approveTokensMaxAmount(address(caller));

  //   uint256 shares = sp.getNumShares(amount);
  //   transferFidu(address(this), address(caller), shares);

  //   _startImpersonation(address(this), address(this));
  //   uint256 requestToken = caller.requestWithdrawal(shares);

  //   assertEq(address(caller), requestTokens.ownerOf(requestToken));
  // }

  event EpochEnded(
    uint256 indexed epochId,
    uint256 endTime,
    uint256 fiduRequested,
    uint256 usdcAllocated,
    uint256 fiduLiquidated
  );
}

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ITranchedPool} from "../../../interfaces/ITranchedPool.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";

contract CallableLoanDepositTest is CallableLoanBaseTest {
  event DepositMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 amount
  );
  event TrancheLocked(address indexed pool, uint256 trancheId, uint256 lockedUntil);

  function testDepositJuniorFailsWithoutGoListOrUid() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(bytes("NA"));
    callableLoan.deposit(2, 1);
  }

  function testDepositJuniorWorksIfGolistedAndWithoutAllowedUid() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    _startImpersonation(BORROWER);
    uint256[] memory allowedTypes = new uint256[](1);
    allowedTypes[0] = 0; // legacy UID type
    callableLoan.setAllowedUIDTypes(allowedTypes);
    _stopImpersonation();
    addToGoList(DEPOSITOR);
    usdc.approve(address(callableLoan), type(uint256).max);
    uint256 poolToken = callableLoan.deposit(2, usdcVal(10));
    assertEq(poolToken, 1);
  }

  function testDepositJuniorWorksIfAllowedUidButNotGoListed() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    uint256 poolToken = callableLoan.deposit(2, usdcVal(100));
    assertEq(poolToken, 1);
  }

  function testDepositJuniorRevertsForZeroDeposit() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(bytes("IA"));
    callableLoan.deposit(2, usdcVal(0));
  }

  function testDepositJuniorRevertsIfJuniorCapitalLocked() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    callableLoan.deposit(2, usdcVal(100));
    lockJuniorTranche(callableLoan);
    vm.expectRevert(bytes("TL"));
    callableLoan.deposit(2, usdcVal(100));
  }

  function testDepositJuniorRevertsIfSeniorCapitalLocked() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    callableLoan.deposit(2, usdcVal(100));
    lockJuniorTranche(callableLoan);
    lockSeniorTranche(callableLoan);
    vm.expectRevert(bytes("TL"));
    callableLoan.deposit(2, usdcVal(100));
  }

  function testDepositJuniorRevertsForInvalidTranche() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert(bytes("invalid tranche"));
    callableLoan.deposit(3, usdcVal(100));
  }

  function testDepositJuniorUpdatesTrancheInfoAndMintsToken() public impersonating(DEPOSITOR) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);

    // Event should be emitted for deposit
    vm.expectEmit(true, true, true, true);
    emit DepositMade(DEPOSITOR, 2, 1, usdcVal(100));

    uint256 poolToken = callableLoan.deposit(2, usdcVal(100));

    // Junior tranche info has principal deposited
    ITranchedPool.TrancheInfo memory junior = callableLoan.getTranche(2);
    assertEq(junior.principalDeposited, usdcVal(100));
    // Senior tranche info unchanged
    ITranchedPool.TrancheInfo memory senior = callableLoan.getTranche(1);
    assertZero(senior.principalDeposited);

    // Token info is correct
    assertEq(poolTokens.ownerOf(poolToken), address(DEPOSITOR));
    PoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolToken);
    assertEq(tokenInfo.principalAmount, usdcVal(100));
    assertEq(tokenInfo.tranche, 2);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);

    // Pool has a balance
    assertEq(usdc.balanceOf(address(callableLoan)), usdcVal(100));
  }

  function testDepositJuniorTrancheInfoUpdatedForTwoDeposits(
    uint256 amount1,
    uint256 amount2
  ) public impersonating(DEPOSITOR) {
    vm.assume(amount1 > 0 && amount2 > 0);
    uint256 total = amount1 + amount2; // Check for underflow
    vm.assume(amount2 < total && total <= usdc.balanceOf(DEPOSITOR));

    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(callableLoan), type(uint256).max);

    callableLoan.deposit(2, amount1);
    callableLoan.deposit(2, amount2);

    ITranchedPool.TrancheInfo memory junior = callableLoan.getTranche(2);
    ITranchedPool.TrancheInfo memory senior = callableLoan.getTranche(1);

    assertEq(junior.principalDeposited, amount1 + amount2, "junior tranche has deposits");
    assertZero(senior.principalDeposited, "senior tranche has 0");
    assertEq(usdc.balanceOf(address(callableLoan)), amount1 + amount2, "pool has balance");
    // TODO: Eventually should just be a single NFT
    assertEq(poolTokens.balanceOf(DEPOSITOR), 2, "depositor has two pool tokens");
  }

  function testLockSeniorTrancheEmitsEvent() public impersonating(BORROWER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    lockJuniorTranche(callableLoan);

    // TODO - this is a bug that should be fixed
    // Weirdly a junior TranchedLocked event is emitted again...
    vm.expectEmit(true, false, false, true);
    emit TrancheLocked(
      address(callableLoan),
      2,
      block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    vm.expectEmit(true, false, false, true);
    emit TrancheLocked(
      address(callableLoan),
      1,
      block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    lockSeniorTranche(callableLoan);
  }

  function testLockJuniorTrancheEmitsEvent() public impersonating(BORROWER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.expectEmit(true, false, false, true);
    emit TrancheLocked(
      address(callableLoan),
      2,
      block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    lockJuniorTranche(callableLoan);
  }

  function testDepositSeniorRevertsIfDepositorIsNotSeniorPool(address notSeniorPool) public {
    vm.assume(notSeniorPool != address(seniorPool));
    vm.assume(notSeniorPool != address(0));
    (CallableLoan callableLoan, ) = defaultCallableLoan();

    lockJuniorTranche(callableLoan);

    _startImpersonation(notSeniorPool);
    vm.expectRevert(bytes("NA"));
    callableLoan.deposit(1, usdcVal(1000));
    _stopImpersonation();
  }

  function testDepositSeniorRevertsForZeroAmount() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.expectRevert(bytes("IA"));
    callableLoan.deposit(1, 0);
  }

  function testSeniorDepositUpdatesTrancheInfoAndMintsToken() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(callableLoan, 2, usdcVal(1000), DEPOSITOR);
    lockJuniorTranche(callableLoan);

    // Event should be emitted for deposit
    vm.expectEmit(true, true, true, true);
    emit DepositMade(address(seniorPool), 1, 2, usdcVal(4000));

    uint256 seniorPoolTokenId = seniorDepositAndInvest(callableLoan, usdcVal(4000));

    // Junior tranche info has principal deposited
    ITranchedPool.TrancheInfo memory junior = callableLoan.getTranche(2);
    assertEq(junior.principalDeposited, usdcVal(1000));
    // Senior tranche info has principal deposited
    ITranchedPool.TrancheInfo memory senior = callableLoan.getTranche(1);
    assertEq(senior.principalDeposited, usdcVal(4000));

    // Token info is correct
    assertEq(poolTokens.balanceOf(address(seniorPool)), 1);
    assertEq(
      poolTokens.ownerOf(seniorPoolTokenId),
      address(seniorPool),
      "Senior pool owns pool token"
    );
    PoolTokens.TokenInfo memory seniorPoolTokenInfo = poolTokens.getTokenInfo(seniorPoolTokenId);
    assertEq(seniorPoolTokenInfo.principalAmount, usdcVal(4000));
    assertEq(seniorPoolTokenInfo.tranche, 1);
    assertZero(seniorPoolTokenInfo.principalRedeemed);
    assertZero(seniorPoolTokenInfo.interestRedeemed);

    // Pool has a balance
    assertEq(usdc.balanceOf(address(callableLoan)), usdcVal(5000));
  }

  function testDepositFailsForInvalidTranches(uint256 trancheId) public {
    vm.assume(trancheId > 2);
    (CallableLoan callableLoan, ) = defaultCallableLoan();

    uid._mintForTest(DEPOSITOR, 1, 1, "");
    _startImpersonation(DEPOSITOR);
    usdc.approve(address(callableLoan), type(uint256).max);
    vm.expectRevert("invalid tranche");
    callableLoan.deposit(trancheId, usdcVal(1));
    _stopImpersonation();
  }

  function testDepositUsingPermit(uint256 userPrivateKey) public {
    vm.assume(userPrivateKey != 0);
    // valid private key space is from [1, secp256k1n − 1]
    vm.assume(
      userPrivateKey <= uint256(0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141)
    );
    address user = vm.addr(userPrivateKey);

    fundAddress(user, usdcVal(100));

    (CallableLoan callableLoan, ) = defaultCallableLoan();

    uint256 nonce = usdc.nonces(user);
    uint256 deadline = block.timestamp + 1;
    // Get signature for permit
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      usdc,
      user,
      address(callableLoan),
      usdcVal(100),
      nonce,
      deadline
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);

    vm.expectEmit(true, true, true, true);
    emit DepositMade(user, 2, 1, usdcVal(100));

    uid._mintForTest(user, 1, 1, "");
    // Deposit with permit
    _startImpersonation(user);
    uint256 poolTokenId = callableLoan.depositWithPermit(2, usdcVal(100), deadline, v, r, s);
    _stopImpersonation();

    ITranchedPool.TrancheInfo memory junior = callableLoan.getTranche(2);
    ITranchedPool.TrancheInfo memory senior = callableLoan.getTranche(1);

    assertEq(junior.principalDeposited, usdcVal(100));
    assertZero(senior.principalDeposited);

    PoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    assertEq(tokenInfo.principalAmount, usdcVal(100));
    assertEq(tokenInfo.tranche, 2);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);

    assertZero(usdc.allowance(user, address(callableLoan)));
  }

  function testLimitDoesNotIncreaseWhenDepositsExceedLimit(
    uint256 limit,
    uint256 depositAmount
  ) public {
    limit = bound(limit, usdcVal(1), usdcVal(10_000_000));
    depositAmount = bound(depositAmount, limit, limit * 10);

    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    setMaxLimit(callableLoan, limit);

    deposit(callableLoan, 2, depositAmount, GF_OWNER);
    lockJuniorTranche(callableLoan);
    lockSeniorTranche(callableLoan);

    assertEq(cl.limit(), limit);
  }

  function testLimitDecreasesToMatchDeposits(uint256 limit, uint256 depositAmount) public {
    limit = bound(limit, usdcVal(1), usdcVal(10_000_000));
    depositAmount = bound(depositAmount, usdcVal(1), limit);

    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    setMaxLimit(callableLoan, limit);

    deposit(callableLoan, 2, depositAmount, GF_OWNER);
    lockJuniorTranche(callableLoan);
    lockSeniorTranche(callableLoan);

    assertEq(cl.limit(), depositAmount);
  }
}

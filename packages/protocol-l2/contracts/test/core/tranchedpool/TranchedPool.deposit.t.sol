// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {IERC20WithName} from "../../../interfaces/IERC20WithName.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";
import {IERC20Permit} from "@openzeppelin/contracts/drafts/IERC20Permit.sol";

contract TranchedPoolDepositTest is TranchedPoolBaseTest {
  event DepositMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 amount
  );
  event TrancheLocked(address indexed pool, uint256 trancheId, uint256 lockedUntil);

  function testDepositJuniorFailsWithoutGoListOrUid(address sender) public impersonating(sender) {
    vm.assume(!go.go(sender));

    (TranchedPool pool, ) = defaultTranchedPool();

    usdc.approve(address(pool), type(uint256).max);
    vm.expectRevert(bytes("NA"));
    pool.deposit(2, 1);
  }

  function testDepositJuniorWorksIfGolistedAndWithoutAllowedUid() public impersonating(DEPOSITOR) {
    (TranchedPool pool, ) = defaultTranchedPool();
    _startImpersonation(BORROWER);
    uint256[] memory allowedTypes = new uint256[](1);
    allowedTypes[0] = 0; // legacy UID type
    pool.setAllowedUIDTypes(allowedTypes);
    _stopImpersonation();
    addToGoList(DEPOSITOR);
    usdc.approve(address(pool), type(uint256).max);
    uint256 poolToken = pool.deposit(2, usdcVal(10));
    assertEq(poolToken, 1);
  }

  function testDepositJuniorWorksIfAllowedUidButNotGoListed() public impersonating(DEPOSITOR) {
    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(pool), type(uint256).max);
    uint256 poolToken = pool.deposit(2, usdcVal(100));
    assertEq(poolToken, 1);
  }

  function testDepositJuniorRevertsForZeroDeposit() public impersonating(DEPOSITOR) {
    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(pool), type(uint256).max);
    vm.expectRevert(bytes("IA"));
    pool.deposit(2, usdcVal(0));
  }

  function testDepositJuniorRevertsIfJuniorCapitalLocked() public impersonating(DEPOSITOR) {
    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(pool), type(uint256).max);
    pool.deposit(2, usdcVal(100));
    lockJuniorTranche(pool);
    vm.expectRevert(bytes("TL"));
    pool.deposit(2, usdcVal(100));
  }

  function testDepositJuniorRevertsIfSeniorCapitalLocked() public impersonating(DEPOSITOR) {
    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(pool), type(uint256).max);
    pool.deposit(2, usdcVal(100));
    lockJuniorTranche(pool);
    lockSeniorTranche(pool);
    vm.expectRevert(bytes("TL"));
    pool.deposit(2, usdcVal(100));
  }

  function testDepositJuniorRevertsForInvalidTranche() public impersonating(DEPOSITOR) {
    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(pool), type(uint256).max);
    vm.expectRevert(bytes("invalid tranche"));
    pool.deposit(3, usdcVal(100));
  }

  function testDepositJuniorUpdatesTrancheInfoAndMintsToken() public impersonating(DEPOSITOR) {
    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(pool), type(uint256).max);

    // Event should be emitted for deposit
    vm.expectEmit(true, true, true, true);
    emit DepositMade(DEPOSITOR, 2, 1, usdcVal(100));

    uint256 poolToken = pool.deposit(2, usdcVal(100));

    // Junior tranche info has principal deposited
    TranchedPool.TrancheInfo memory junior = pool.getTranche(2);
    assertEq(junior.principalDeposited, usdcVal(100));
    // Senior tranche info unchanged
    TranchedPool.TrancheInfo memory senior = pool.getTranche(1);
    assertZero(senior.principalDeposited);

    // Token info is correct
    assertEq(poolTokens.ownerOf(poolToken), address(DEPOSITOR));
    PoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolToken);
    assertEq(tokenInfo.principalAmount, usdcVal(100));
    assertEq(tokenInfo.tranche, 2);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);

    // Pool has a balance
    assertEq(usdc.balanceOf(address(pool)), usdcVal(100));
  }

  function testDepositJuniorTrancheInfoUpdatedForTwoDeposits(
    uint256 amount1,
    uint256 amount2
  ) public impersonating(DEPOSITOR) {
    vm.assume(amount1 > 0 && amount2 > 0);
    uint256 total = amount1 + amount2; // Check for underflow
    vm.assume(amount2 < total && total <= usdc.balanceOf(DEPOSITOR));

    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");
    usdc.approve(address(pool), type(uint256).max);

    pool.deposit(2, amount1);
    pool.deposit(2, amount2);

    TranchedPool.TrancheInfo memory junior = pool.getTranche(2);
    TranchedPool.TrancheInfo memory senior = pool.getTranche(1);

    assertEq(junior.principalDeposited, amount1 + amount2, "junior tranche has deposits");
    assertZero(senior.principalDeposited, "senior tranche has 0");
    assertEq(usdc.balanceOf(address(pool)), amount1 + amount2, "pool has balance");
    // TODO: Eventually should just be a single NFT
    assertEq(poolTokens.balanceOf(DEPOSITOR), 2, "depositor has two pool tokens");
  }

  function testLockSeniorTrancheEmitsEvent() public impersonating(BORROWER) {
    (TranchedPool pool, ) = defaultTranchedPool();
    lockJuniorTranche(pool);

    // TODO - this is a bug that should be fixed
    // Weirdly a junior TranchedLocked event is emitted again...
    vm.expectEmit(true, false, false, true);
    emit TrancheLocked(address(pool), 2, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    vm.expectEmit(true, false, false, true);
    emit TrancheLocked(address(pool), 1, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    lockSeniorTranche(pool);
  }

  function testLockJuniorTrancheEmitsEvent() public impersonating(BORROWER) {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.expectEmit(true, false, false, true);
    emit TrancheLocked(address(pool), 2, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    lockJuniorTranche(pool);
  }

  function testDepositSeniorRevertsIfDepositorIsNotSeniorPool(address notSeniorPool) public {
    vm.assume(notSeniorPool != address(this));
    vm.assume(notSeniorPool != address(0));
    (TranchedPool pool, ) = defaultTranchedPool();

    lockJuniorTranche(pool);

    _startImpersonation(notSeniorPool);
    vm.expectRevert(bytes("NA"));
    pool.deposit(1, usdcVal(1000));
    _stopImpersonation();
  }

  function testDepositSeniorRevertsForZeroAmount() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.expectRevert(bytes("IA"));
    pool.deposit(1, 0);
  }

  function testSeniorDepositUpdatesTrancheInfoAndMintsToken() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    uid._mintForTest(DEPOSITOR, 1, 1, "");

    deposit(pool, 2, usdcVal(1000), DEPOSITOR);
    lockJuniorTranche(pool);

    // Event should be emitted for deposit
    vm.expectEmit(true, true, true, true);
    emit DepositMade(address(this), 1, 2, usdcVal(4000));

    uint256 seniorPoolTokenId = seniorDepositAndInvest(pool, usdcVal(4000));

    // Junior tranche info has principal deposited
    TranchedPool.TrancheInfo memory junior = pool.getTranche(2);
    assertEq(junior.principalDeposited, usdcVal(1000));
    // Senior tranche info has principal deposited
    TranchedPool.TrancheInfo memory senior = pool.getTranche(1);
    assertEq(senior.principalDeposited, usdcVal(4000));

    // Token info is correct
    assertEq(poolTokens.balanceOf(address(this)), 1);
    assertEq(poolTokens.ownerOf(seniorPoolTokenId), address(this), "Senior pool owns pool token");
    PoolTokens.TokenInfo memory seniorPoolTokenInfo = poolTokens.getTokenInfo(seniorPoolTokenId);
    assertEq(seniorPoolTokenInfo.principalAmount, usdcVal(4000));
    assertEq(seniorPoolTokenInfo.tranche, 1);
    assertZero(seniorPoolTokenInfo.principalRedeemed);
    assertZero(seniorPoolTokenInfo.interestRedeemed);

    // Pool has a balance
    assertEq(usdc.balanceOf(address(pool)), usdcVal(5000));
  }

  function testDepositFailsForInvalidTranches(uint256 trancheId) public {
    vm.assume(trancheId > 2);
    (TranchedPool pool, ) = defaultTranchedPool();

    uid._mintForTest(DEPOSITOR, 1, 1, "");
    _startImpersonation(DEPOSITOR);
    usdc.approve(address(pool), type(uint256).max);
    vm.expectRevert("invalid tranche");
    pool.deposit(trancheId, usdcVal(1));
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

    (TranchedPool pool, ) = defaultTranchedPool();

    uint256 nonce = usdc.nonces(user);
    uint256 deadline = block.timestamp + 1;
    // Get signature for permit
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      IERC20WithName(address(usdc)),
      user,
      address(pool),
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
    uint256 poolTokenId = pool.depositWithPermit(2, usdcVal(100), deadline, v, r, s);
    _stopImpersonation();

    TranchedPool.TrancheInfo memory junior = pool.getTranche(2);
    TranchedPool.TrancheInfo memory senior = pool.getTranche(1);

    assertEq(junior.principalDeposited, usdcVal(100));
    assertZero(senior.principalDeposited);

    PoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    assertEq(tokenInfo.principalAmount, usdcVal(100));
    assertEq(tokenInfo.tranche, 2);
    assertZero(tokenInfo.principalRedeemed);
    assertZero(tokenInfo.interestRedeemed);

    assertZero(usdc.allowance(user, address(pool)));
  }

  function testLimitDoesNotIncreaseWhenDepositsExceedLimit(
    uint256 limit,
    uint256 depositAmount
  ) public {
    limit = bound(limit, usdcVal(1), usdcVal(10_000_000));
    depositAmount = bound(depositAmount, limit, limit * 10);

    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    setMaxLimit(pool, limit);

    deposit(pool, 2, depositAmount, GF_OWNER);
    lockJuniorTranche(pool);
    lockSeniorTranche(pool);

    assertEq(cl.limit(), limit);
  }

  function testLimitDecreasesToMatchDeposits(uint256 limit, uint256 depositAmount) public {
    limit = bound(limit, usdcVal(1), usdcVal(10_000_000));
    depositAmount = bound(depositAmount, usdcVal(1), limit);

    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    setMaxLimit(pool, limit);

    deposit(pool, 2, depositAmount, GF_OWNER);
    lockJuniorTranche(pool);
    lockSeniorTranche(pool);

    assertEq(cl.limit(), depositAmount);
  }
}

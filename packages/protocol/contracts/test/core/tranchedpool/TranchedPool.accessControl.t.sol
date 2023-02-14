// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {IERC20WithName} from "../../../interfaces/IERC20WithName.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";

contract TranchedPoolAccessControlTest is TranchedPoolBaseTest {
  function testAccessControlOwnerIsGovernance() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    assertTrue(pool.hasRole(pool.OWNER_ROLE(), GF_OWNER));
  }

  function testAccessControlPauseIsGovernance() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    assertTrue(pool.hasRole(pool.PAUSER_ROLE(), GF_OWNER));
  }

  function testAccessControlLockerIsBorrowerAndGovernance() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), GF_OWNER));
    assertTrue(pool.hasRole(pool.LOCKER_ROLE(), cl.borrower()));
  }

  function testOwnerCanGrantRoles(address user) public impersonating(GF_OWNER) {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.assume(fuzzHelper.isAllowed(user));

    assertFalse(pool.hasRole(pool.OWNER_ROLE(), user));
    pool.grantRole(pool.OWNER_ROLE(), user);
    assertTrue(pool.hasRole(pool.OWNER_ROLE(), user));

    assertFalse(pool.hasRole(pool.PAUSER_ROLE(), user));
    pool.grantRole(pool.PAUSER_ROLE(), user);
    assertTrue(pool.hasRole(pool.PAUSER_ROLE(), user));
  }

  function testNonOwnerCannotGrantRoles(address user) public impersonating(user) {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.assume(fuzzHelper.isAllowed(user));

    bytes32 ownerRole = pool.OWNER_ROLE();
    vm.expectRevert("AccessControl: sender must be an admin to grant");
    pool.grantRole(ownerRole, user);
  }

  function testPausingPausesFunctions() public {
    (TranchedPool pool, ) = defaultTranchedPool();
    pause(pool);

    vm.expectRevert("Pausable: paused");
    pool.deposit(2, usdcVal(1));

    vm.expectRevert("Pausable: paused");
    pool.depositWithPermit(2, usdcVal(1), 0, 0, 0, 0);

    vm.expectRevert("Pausable: paused");
    pool.withdraw(1, usdcVal(1));

    vm.expectRevert("Pausable: paused");
    pool.withdrawMax(1);

    uint256[] memory tokens = new uint256[](1);
    uint256[] memory amounts = new uint256[](1);
    vm.expectRevert("Pausable: paused");
    pool.withdrawMultiple(tokens, amounts);

    _startImpersonation(BORROWER);
    vm.expectRevert("Pausable: paused");
    pool.drawdown(usdcVal(1));

    vm.expectRevert("Pausable: paused");
    pool.lockJuniorCapital();

    vm.expectRevert("Pausable: paused");
    pool.lockPool();

    vm.expectRevert("Pausable: paused");
    pool.initializeNextSlice(block.timestamp);
    _stopImpersonation();

    vm.expectRevert("Pausable: paused");
    pool.pay(usdcVal(1));

    vm.expectRevert("Pausable: paused");
    pool.pay(usdcVal(1), usdcVal(1));
  }

  function testUnpauseUnpausesFunctions(uint256 userPrivateKey) public {
    vm.assume(userPrivateKey != 0);
    // valid private key space is from [1, secp256k1n − 1]
    vm.assume(
      userPrivateKey <= uint256(0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141)
    );
    address user = vm.addr(userPrivateKey);
    uid._mintForTest(user, 1, 1, "");
    fundAddress(user, usdcVal(200));

    (TranchedPool pool, ) = defaultTranchedPool();
    pause(pool);
    unpause(pool);

    // None of these calls should revert
    deposit(pool, 2, usdcVal(100), user);
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      IERC20WithName(address(usdc)),
      user,
      address(pool),
      usdcVal(100),
      usdc.nonces(user),
      block.timestamp + 1
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
    depositWithPermit(pool, 2, usdcVal(100), block.timestamp + 1, v, r, s, user);

    withdraw(pool, 1, usdcVal(1), user);
    withdrawMax(pool, 2, user);
    lockJuniorTranche(pool);
    lockSeniorTranche(pool);
    drawdown(pool, usdcVal(99));
    pay(pool, usdcVal(99));
  }

  function testOwnerCanPause() public impersonating(GF_OWNER) {
    (TranchedPool pool, ) = defaultTranchedPool();
    pool.pause();
    assertTrue(pool.paused());
  }

  function testNonOwnerCannotPause(address user) public impersonating(user) {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.assume(fuzzHelper.isAllowed(user));
    vm.expectRevert(bytes("NA"));
    pool.pause();
  }

  function testBorrowerCanLockTranches(uint256 juniorDepositAmount) public impersonating(BORROWER) {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();

    juniorDepositAmount = bound(juniorDepositAmount, usdcVal(1), usdcVal(1000));
    deposit(pool, 2, juniorDepositAmount, GF_OWNER);

    pool.lockJuniorCapital();
    assertEq(pool.getTranche(2).lockedUntil, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    assertEq(pool.getTranche(2).principalSharePrice, UNIT_SHARE_PRICE);

    seniorDepositAndInvest(pool, juniorDepositAmount * 4);
    pool.lockPool();
    assertEq(pool.getTranche(1).lockedUntil, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    assertEq(pool.getTranche(1).principalSharePrice, UNIT_SHARE_PRICE);
    // Limit should be the sum of junior and senior deposits
    assertEq(cl.limit(), juniorDepositAmount * 5);
  }

  function testOwnerCanLockTranches(uint256 juniorDepositAmount) public impersonating(GF_OWNER) {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();

    juniorDepositAmount = bound(juniorDepositAmount, usdcVal(1), usdcVal(10_000));
    deposit(pool, 2, juniorDepositAmount, GF_OWNER);

    pool.lockJuniorCapital();
    assertEq(pool.getTranche(2).lockedUntil, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    assertEq(pool.getTranche(2).principalSharePrice, UNIT_SHARE_PRICE);

    seniorDepositAndInvest(pool, juniorDepositAmount * 4);
    pool.lockPool();
    assertEq(pool.getTranche(1).lockedUntil, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
    assertEq(pool.getTranche(1).principalSharePrice, UNIT_SHARE_PRICE);
    // Limit should be the sum of junior and senior deposits
    assertEq(cl.limit(), juniorDepositAmount * 5);
  }

  function testCannotLockTrancheTwice() public impersonating(BORROWER) {
    (TranchedPool pool, ) = defaultTranchedPool();
    pool.lockJuniorCapital();
    assertEq(pool.getTranche(2).lockedUntil, block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);

    vm.expectRevert(bytes("TL"));
    pool.lockJuniorCapital();

    pool.lockPool();

    vm.expectRevert(bytes("TL"));
    pool.lockPool();
  }

  function testNonBorrowerNonOwnerCannotLockTranches(
    address nonBorrowerNonOwner
  ) public impersonating(nonBorrowerNonOwner) {
    vm.assume(fuzzHelper.isAllowed(nonBorrowerNonOwner));

    (TranchedPool pool, ) = defaultTranchedPool();
    vm.expectRevert(bytes("NA"));
    pool.lockJuniorCapital();

    _startImpersonation(BORROWER);
    pool.lockJuniorCapital();
    _stopImpersonation();

    vm.expectRevert(bytes("NA"));
    pool.lockPool();
  }
}

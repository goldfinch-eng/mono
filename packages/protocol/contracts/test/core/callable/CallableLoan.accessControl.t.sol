// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";

import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {DepositWithPermitHelpers} from "../../helpers/DepositWithPermitHelpers.t.sol";
import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanAccessControlTest is CallableLoanBaseTest {
  function testAccessControlOwnerIsGovernance() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    assertTrue(callableLoan.hasRole(callableLoan.OWNER_ROLE(), GF_OWNER));
  }

  function testAccessControlPauseIsGovernance() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    assertTrue(callableLoan.hasRole(callableLoan.PAUSER_ROLE(), GF_OWNER));
  }

  function testAccessControlLockerIsBorrowerAndGovernance() public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    assertTrue(callableLoan.hasRole(callableLoan.LOCKER_ROLE(), GF_OWNER));
    assertTrue(callableLoan.hasRole(callableLoan.LOCKER_ROLE(), callableLoan.borrower()));
  }

  function testOwnerCanGrantRoles(address user) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));

    assertFalse(callableLoan.hasRole(callableLoan.OWNER_ROLE(), user));
    callableLoan.grantRole(callableLoan.OWNER_ROLE(), user);
    assertTrue(callableLoan.hasRole(callableLoan.OWNER_ROLE(), user));

    assertFalse(callableLoan.hasRole(callableLoan.PAUSER_ROLE(), user));
    callableLoan.grantRole(callableLoan.PAUSER_ROLE(), user);
    assertTrue(callableLoan.hasRole(callableLoan.PAUSER_ROLE(), user));
  }

  function testNonOwnerCannotGrantRoles(address user) public impersonating(user) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));

    bytes32 ownerRole = callableLoan.OWNER_ROLE();
    vm.expectRevert("AccessControl: sender must be an admin to grant");
    callableLoan.grantRole(ownerRole, user);
  }

  function testPausingPausesFunctions() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    pause(callableLoan);

    vm.expectRevert("Pausable: paused");
    callableLoan.deposit(1, usdcVal(1));

    vm.expectRevert("Pausable: paused");
    callableLoan.depositWithPermit(1, usdcVal(1), 0, 0, 0, 0);

    vm.expectRevert("Pausable: paused");
    callableLoan.withdraw(1, usdcVal(1));

    vm.expectRevert("Pausable: paused");
    callableLoan.withdrawMax(1);

    uint256[] memory tokens = new uint256[](1);
    uint256[] memory amounts = new uint256[](1);
    vm.expectRevert("Pausable: paused");
    callableLoan.withdrawMultiple(tokens, amounts);

    _startImpersonation(BORROWER);
    vm.expectRevert("Pausable: paused");
    callableLoan.drawdown(usdcVal(1));

    _startImpersonation(BORROWER);
    vm.expectRevert("Pausable: paused");
    callableLoan.lockPool();

    vm.expectRevert("Pausable: paused");
    callableLoan.initializeNextSlice(block.timestamp);
    _stopImpersonation();

    vm.expectRevert("Pausable: paused");
    callableLoan.pay(usdcVal(1));

    vm.expectRevert("Pausable: paused");
    callableLoan.pay(usdcVal(1), usdcVal(1));
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

    (CallableLoan callableLoan, ) = defaultCallableLoan();
    pause(callableLoan);
    unpause(callableLoan);

    // None of these calls should revert
    deposit(callableLoan, 1, usdcVal(100), user);
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      usdc,
      user,
      address(callableLoan),
      usdcVal(100),
      usdc.nonces(user),
      block.timestamp + 1
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
    depositWithPermit(callableLoan, 1, usdcVal(100), block.timestamp + 1, v, r, s, user);

    withdraw(callableLoan, 1, usdcVal(1), user);
    withdrawMax(callableLoan, 2, user);
    drawdown(callableLoan, usdcVal(99));
    pay(callableLoan, usdcVal(99));
  }

  function testOwnerCanPause() public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    callableLoan.pause();
    assertTrue(callableLoan.paused());
  }

  function testNonOwnerCannotPause(address user) public impersonating(user) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    vm.expectRevert(bytes("NA"));
    callableLoan.pause();
  }

  // TODO: Unclear if locking should still be supported.
  // function testBorrowerCanLockPool(
  //   uint256 depositAmount,
  //   address depositor
  // ) public impersonating(BORROWER) {
  //   (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();

  //   vm.assume(depositAmount > 0);
  //   vm.assume(fuzzHelper.isAllowed(depositor));
  //   depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000));

  //   uid._mintForTest(depositor, 1, 1, "");
  //   depositAndDrawdown(callableLoan, depositAmount, depositor);
  //   assertEq(
  //     callableLoan.getTranche(1).lockedUntil,
  //     block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
  //   );

  //   //TODO: Add in tests for equivalent of principal share price behavior.
  //   assertEq(cl.limit(), depositAmount);
  // }

  // function testOwnerCanLockPools(uint256 depositAmount) public impersonating(GF_OWNER) {
  //   (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();

  //   depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000));
  //   deposit(callableLoan, 1, depositAmount, GF_OWNER);

  //   callableLoan.lockPool();
  //   assertEq(
  //     callableLoan.getTranche(1).lockedUntil,
  //     block.timestamp + DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
  //   );
  //   assertEq(callableLoan.getTranche(1).principalSharePrice, UNIT_SHARE_PRICE);
  //   // Limit should be the sum of junior and senior deposits
  //   assertEq(cl.limit(), depositAmount);
  // }

  // function testCannotLockPoolTwice() public impersonating(BORROWER) {
  //   (CallableLoan callableLoan, ) = defaultCallableLoan();

  //   callableLoan.lockPool();

  //   vm.expectRevert(bytes("TL"));
  //   callableLoan.lockPool();
  // }

  // function testNonBorrowerNonOwnerCannotLockPool(
  //   address nonBorrowerNonOwner
  // ) public impersonating(nonBorrowerNonOwner) {
  //   vm.assume(fuzzHelper.isAllowed(nonBorrowerNonOwner));

  //   (CallableLoan callableLoan, ) = defaultCallableLoan();

  //   vm.expectRevert(bytes("NA"));
  //   callableLoan.lockPool();
  // }
}

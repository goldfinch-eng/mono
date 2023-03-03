// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
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
    vm.expectRevert(
      abi.encodePacked(
        "AccessControl: account ",
        StringsUpgradeable.toHexString(uint160(user), 20),
        " is missing role ",
        StringsUpgradeable.toHexString(uint256(ownerRole), 32)
      )
    );

    callableLoan.grantRole(ownerRole, user);
  }

  function testPausingPausesFunctions() public {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    pause(callableLoan);

    vm.expectRevert("Pausable: paused");
    callableLoan.deposit(3, usdcVal(1));

    vm.expectRevert("Pausable: paused");
    callableLoan.depositWithPermit(3, usdcVal(1), 0, 0, 0, 0);

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
    deposit(callableLoan, callableLoan.uncalledCapitalTrancheIndex(), usdcVal(100), user);
    bytes32 digest = DepositWithPermitHelpers.approvalDigest(
      usdc,
      user,
      address(callableLoan),
      usdcVal(100),
      usdc.nonces(user),
      block.timestamp + 1
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
    depositWithPermit(
      callableLoan,
      callableLoan.uncalledCapitalTrancheIndex(),
      usdcVal(100),
      block.timestamp + 1,
      v,
      r,
      s,
      user
    );

    withdraw(callableLoan, 1, usdcVal(1), user);
    withdrawMax(callableLoan, 2, user);
    drawdown(callableLoan, usdcVal(99));
    warpToAfterDrawdownPeriod(callableLoan);
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
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";
import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract UniqueIdentityInitializeTest is UniqueIdentityBaseTest {
  function testCantInitializeWithNullOwner() public {
    TestUniqueIdentity uid2 = new TestUniqueIdentity();
    vm.expectRevert("Owner address cannot be empty");
    uid2.initialize(address(0), "UNIQUE-IDENTITY-URI");
  }

  function testOwnerShouldHaveOwnerAndPauserAndSignerRoles() public {
    assertTrue(uid.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
    assertTrue(uid.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
    assertTrue(uid.hasRole(TestConstants.SIGNER_ROLE, GF_OWNER));
  }

  function testNonOwnerShouldNotHaveOwnerOrPauserOrSignerRoles(
    address notOwner
  ) public impersonating(notOwner) {
    vm.assume(notOwner != GF_OWNER);
    assertFalse(uid.hasRole(TestConstants.OWNER_ROLE, address(this)));
    assertFalse(uid.hasRole(TestConstants.PAUSER_ROLE, address(this)));
    assertFalse(uid.hasRole(TestConstants.SIGNER_ROLE, address(this)));
  }

  function testInitializerCantBeCalledAgain() public {
    vm.expectRevert("Initializable: contract is already initialized");
    uid.initialize(GF_OWNER, "YOYOYO");
  }

  function testHasExpectedName() public {
    assertEq(uid.name(), "Unique Identity");
  }

  function testHasExpectedSymbol() public {
    assertEq(uid.symbol(), "UID");
  }
}

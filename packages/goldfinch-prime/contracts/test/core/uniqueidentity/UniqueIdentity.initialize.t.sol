// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";
import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";

contract UniqueIdentityInitializeTest is UniqueIdentityBaseTest {
  function testCantInitializeWithNullOwner() public {
    TestUniqueIdentity uid2 = new TestUniqueIdentity();

    IGoldfinchConfig config = protocol.gfConfig();
    vm.expectRevert("Owner address cannot be empty");
    uid2.initialize(address(0), address(config), "UNIQUE-IDENTITY-URI");
  }

  function testOwnerShouldHaveOwnerAndSignerRoles() public view {
    assertTrue(uid.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
    assertTrue(uid.hasRole(TestConstants.SIGNER_ROLE, GF_OWNER));
  }

  function testNonOwnerShouldNotHaveOwnerOrSignerRoles(
    address notOwner
  ) public impersonating(notOwner) {
    vm.assume(notOwner != GF_OWNER);
    assertFalse(uid.hasRole(TestConstants.OWNER_ROLE, address(this)));
    assertFalse(uid.hasRole(TestConstants.SIGNER_ROLE, address(this)));
  }

  function testInitializerCantBeCalledAgain() public {
    IGoldfinchConfig config = protocol.gfConfig();
    vm.expectRevert(
      abi.encodeWithSignature("InvalidInitialization()")
    );
    uid.initialize(GF_OWNER, address(config), "YOYOYO");
  }

  function testHasExpectedName() public view {
    assertEq(uid.name(), "Unique Identity");
  }

  function testHasExpectedSymbol() public view {
    assertEq(uid.symbol(), "UID");
  }
}

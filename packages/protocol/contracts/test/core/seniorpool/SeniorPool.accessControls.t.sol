// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {SeniorPoolBaseTest} from "../BaseSeniorPool.t.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract SeniorPoolAccessControlsTest is SeniorPoolBaseTest {
  function testSetsOwner() public {
    assertTrue(sp.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
    assertEq(sp.getRoleAdmin(TestConstants.OWNER_ROLE), TestConstants.OWNER_ROLE);
  }

  function testSetsPauser() public {
    assertTrue(sp.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
    assertEq(sp.getRoleAdmin(TestConstants.PAUSER_ROLE), TestConstants.OWNER_ROLE);
  }

  function testAllowsOwnerToAddToRoles(
    address nonOwner
  ) public impersonating(GF_OWNER) onlyAllowListed(nonOwner) {
    assertFalse(sp.hasRole(TestConstants.OWNER_ROLE, nonOwner));
    assertFalse(sp.hasRole(TestConstants.PAUSER_ROLE, nonOwner));
    sp.grantRole(TestConstants.OWNER_ROLE, nonOwner);
    sp.grantRole(TestConstants.PAUSER_ROLE, nonOwner);
    assertTrue(sp.hasRole(TestConstants.OWNER_ROLE, nonOwner));
    assertTrue(sp.hasRole(TestConstants.PAUSER_ROLE, nonOwner));
  }

  function testNonOwnerCannotAddToRoles(
    address nonOwner
  ) public onlyAllowListed(nonOwner) impersonating(nonOwner) {
    vm.expectRevert(bytes("AccessControl: sender must be an admin to grant"));
    sp.grantRole(TestConstants.OWNER_ROLE, nonOwner);
  }
}

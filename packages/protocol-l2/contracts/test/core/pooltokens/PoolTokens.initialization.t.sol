// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {PoolTokensBaseTest} from "./PoolTokensBase.t.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract PoolTokensInitializationTest is PoolTokensBaseTest {
  function testCantBeInitializedTwice() public {
    vm.expectRevert("Initializable: contract is already initialized");
    poolTokens.__initialize__(GF_OWNER, gfConfig);
  }

  function testOwnerIsAdmin() public impersonating(GF_OWNER) {
    assertTrue(poolTokens.isAdmin());
  }

  function testNonOwnerIsNotAdmin(address nonAdmin) public impersonating(nonAdmin) {
    vm.assume(nonAdmin != GF_OWNER);
    assertFalse(poolTokens.isAdmin());
  }

  function testOwnerHasOwnerRole() public {
    assertTrue(poolTokens.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
  }

  function testNonOwnerDoesNotHaveOwnerRole(address nonOwner) public {
    vm.assume(nonOwner != GF_OWNER);
    assertFalse(poolTokens.hasRole(TestConstants.OWNER_ROLE, nonOwner));
  }

  function testOwnerHasPauserRole() public {
    assertTrue(poolTokens.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
  }

  function testNonOwnerDoesNotHavePauserRole(address nonOwner) public {
    vm.assume(nonOwner != GF_OWNER);
    assertFalse(poolTokens.hasRole(TestConstants.PAUSER_ROLE, nonOwner));
  }
}

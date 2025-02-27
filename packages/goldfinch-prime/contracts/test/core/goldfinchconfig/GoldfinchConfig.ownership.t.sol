// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchConfigBaseTest} from "./BaseGoldfinchConfig.t.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract GoldfinchConfigOwnershipTest is GoldfinchConfigBaseTest {
  function testOwnerShouldBeGfOwner() public view {
    assertTrue(gfConfig.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
  }

  function testNotGfOwnerShouldNotBeOwner(address notGfOwner) public view {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.OWNER_ROLE, notGfOwner));
  }

  function testOwnerShouldHavePauserRole() public view {
    assertTrue(gfConfig.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
  }

  function testNotGfOwnerShouldNotHavePauserRole(address notGfOwner) public view {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.PAUSER_ROLE, notGfOwner));
  }
}

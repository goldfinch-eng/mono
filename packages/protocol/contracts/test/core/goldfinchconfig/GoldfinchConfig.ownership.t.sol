// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {GoldfinchConfigBaseTest} from "./BaseGoldfinchConfig.t.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract GoldfinchConfigOwnershipTest is GoldfinchConfigBaseTest {
  function testOwnerShouldBeGfOwner() public {
    assertTrue(gfConfig.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
  }

  function testNotGfOwnerShouldNotBeOwner(address notGfOwner) public {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.OWNER_ROLE, notGfOwner));
  }

  function testOwnerShouldHavePauserRole() public {
    assertTrue(gfConfig.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
  }

  function testNotGfOwnerShouldNotHavePauserRole(address notGfOwner) public {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.PAUSER_ROLE, notGfOwner));
  }

  function testOwnerShouldHaveGoListerRole() public {
    assertTrue(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, GF_OWNER));
  }

  function testNotGfOwnerShouldNotHaveGoListerRole(address notGfOwner) public {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));
  }
}

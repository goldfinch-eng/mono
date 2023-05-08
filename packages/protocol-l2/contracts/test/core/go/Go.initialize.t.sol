// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {GoBaseTest} from "./BaseGo.t.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {Go} from "../../../protocol/core/Go.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";

contract GoInitializeTest is GoBaseTest {
  function testInitializeRevertsIfOwnerIsZeroAddress(address config, address uid) public {
    vm.assume(config != address(0));
    vm.assume(uid != address(0));

    Go newGo = new Go();
    vm.expectRevert("Owner and config and UniqueIdentity addresses cannot be empty");
    newGo.initialize(address(0), GoldfinchConfig(config), uid);
  }

  function testInitializeRevertsIfConfigIsZeroAddress(address owner, address uid) public {
    vm.assume(owner != address(0));
    vm.assume(uid != address(0));

    Go newGo = new Go();
    vm.expectRevert("Owner and config and UniqueIdentity addresses cannot be empty");
    newGo.initialize(owner, GoldfinchConfig(address(0)), uid);
  }

  function testInitializeRevertsIfUidIsZeroAddress(address owner, address config) public {
    vm.assume(owner != address(0));
    vm.assume(config != address(0));

    Go newGo = new Go();
    vm.expectRevert("Owner and config and UniqueIdentity addresses cannot be empty");
    newGo.initialize(owner, GoldfinchConfig(config), address(0));
  }

  function testInitializeGrantsOwnerAndPauserRoles() public {
    assertTrue(go.hasRole(TestConstants.OWNER_ROLE, GF_OWNER));
    assertTrue(go.hasRole(TestConstants.PAUSER_ROLE, GF_OWNER));
  }

  function testInitializeDoesntGrantOwnerAndPauseRolesToDeployer() public {
    assertFalse(go.hasRole(TestConstants.OWNER_ROLE, address(this)));
    assertFalse(go.hasRole(TestConstants.PAUSER_ROLE, address(this)));
  }

  function testSetsTheConfigAndUidInState() public {
    assertEq(address(go.config()), address(gfConfig));
    assertEq(address(go.uniqueIdentity()), address(uid));
  }

  function testCannotBeCalledTwice() public {
    vm.expectRevert("Contract instance has already been initialized");
    go.initialize(GF_OWNER, gfConfig, address(uid));
  }
}

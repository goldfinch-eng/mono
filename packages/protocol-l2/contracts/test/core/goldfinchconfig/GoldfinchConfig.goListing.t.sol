// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {GoldfinchConfigBaseTest} from "./BaseGoldfinchConfig.t.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract GoldfinchConfigGoListingTest is GoldfinchConfigBaseTest {
  function testAddToGoListAddsAddressToGoList(address userToGoList) public impersonating(GF_OWNER) {
    assertFalse(gfConfig.goList(userToGoList));
    gfConfig.addToGoList(userToGoList);
    assertTrue(gfConfig.goList(userToGoList));
  }

  function testAddToGoListShouldBeAllowedForNonOwnerGoLister(
    address notGfOwner,
    address userToGoList
  ) public {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));

    grantRole(address(gfConfig), TestConstants.GO_LISTER_ROLE, notGfOwner);

    assertTrue(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));
    assertFalse(gfConfig.goList(userToGoList));

    _startImpersonation(notGfOwner);
    gfConfig.addToGoList(userToGoList);
    _stopImpersonation();

    assertTrue(gfConfig.goList(userToGoList));
  }

  function testAddToGoListRevertsForNonOwnerNonGoLister(
    address sender,
    address userToGoList
  ) public {
    vm.assume(sender != GF_OWNER);
    vm.assume(!gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, sender));

    vm.expectRevert("Must have go-lister role to perform this action");
    _startImpersonation(sender);
    gfConfig.addToGoList(userToGoList);
  }

  function testBulkAddToGoListAddsManyPeopleToGoList(
    address[] calldata usersToAdd
  ) public impersonating(GF_OWNER) {
    for (uint256 i = 0; i < usersToAdd.length; ++i) {
      vm.assume(!gfConfig.goList(usersToAdd[i]));
    }

    gfConfig.bulkAddToGoList(usersToAdd);

    for (uint256 i = 0; i < usersToAdd.length; ++i) {
      assertTrue(gfConfig.goList(usersToAdd[i]));
    }
  }

  function testNonOwnerGoListerCanBulkAddToGoList(
    address notGfOwner,
    address[] calldata usersToAdd
  ) public {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));
    grantRole(address(gfConfig), TestConstants.GO_LISTER_ROLE, notGfOwner);
    assertTrue(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));

    for (uint256 i = 0; i < usersToAdd.length; ++i) {
      vm.assume(!gfConfig.goList(usersToAdd[i]));
    }

    _startImpersonation(notGfOwner);
    gfConfig.bulkAddToGoList(usersToAdd);

    for (uint256 i = 0; i < usersToAdd.length; ++i) {
      assertTrue(gfConfig.goList(usersToAdd[i]));
    }
  }

  function testBulkAddToGoListRevertsForNonOwnerNonGoLister(
    address notGfOwner,
    address[] calldata usersToAdd
  ) public {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));

    for (uint256 i = 0; i < usersToAdd.length; ++i) {
      vm.assume(!gfConfig.goList(usersToAdd[i]));
    }

    _startImpersonation(notGfOwner);
    vm.expectRevert("Must have go-lister role to perform this action");
    gfConfig.bulkAddToGoList(usersToAdd);
  }

  function testRemoveFromGoListRemovesUserFromGoList(address user) public impersonating(GF_OWNER) {
    assertFalse(gfConfig.goList(user));

    gfConfig.addToGoList(user);
    assertTrue(gfConfig.goList(user));

    gfConfig.removeFromGoList(user);
    assertFalse(gfConfig.goList(user));
  }

  function testUserNotOnGoListRemovedFromGoListIsStillNotOnGoList(
    address user
  ) public impersonating(GF_OWNER) {
    assertFalse(gfConfig.goList(user));
    gfConfig.removeFromGoList(user);
    assertFalse(gfConfig.goList(user));
  }

  function testNonOwnerGoListerCanRemoveFromGoList(address notGfOwner, address user) public {
    vm.assume(notGfOwner != GF_OWNER);
    assertFalse(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));
    grantRole(address(gfConfig), TestConstants.GO_LISTER_ROLE, notGfOwner);
    assertTrue(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));

    vm.assume(!gfConfig.goList(user));
    _startImpersonation(notGfOwner);
    gfConfig.addToGoList(user);
    assertTrue(gfConfig.goList(user));
    gfConfig.removeFromGoList(user);
    assertFalse(gfConfig.goList(user));
  }

  function testRemoveFromGoListRevertsForNonOwnerNonGoLister(
    address notGfOwner,
    address user
  ) public {
    vm.assume(notGfOwner != GF_OWNER);
    vm.assume(!gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));
    vm.assume(!gfConfig.goList(user));

    _startImpersonation(GF_OWNER);
    gfConfig.addToGoList(user);
    assertTrue(gfConfig.goList(user));

    _startImpersonation(notGfOwner);
    vm.expectRevert("Must have go-lister role to perform this action");
    gfConfig.removeFromGoList(user);
    assertTrue(gfConfig.goList(user));
  }

  function testBulkRemoveFromGoListRemovesMultipleUsersFromGoList(
    address[] calldata users
  ) public impersonating(GF_OWNER) {
    for (uint256 i = 0; i < users.length; ++i) {
      vm.assume(!gfConfig.goList(users[i]));
    }

    gfConfig.bulkAddToGoList(users);
    for (uint256 i = 0; i < users.length; ++i) {
      assertTrue(gfConfig.goList(users[i]));
    }

    gfConfig.bulkRemoveFromGoList(users);
    for (uint256 i = 0; i < users.length; ++i) {
      assertFalse(gfConfig.goList(users[i]));
    }
  }

  function testNonOwnerGoListerCanBulkRemoveFromGoList(
    address notGfOwner,
    address[] calldata users
  ) public {
    vm.assume(notGfOwner != GF_OWNER);
    vm.assume(!gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));

    for (uint256 i = 0; i < users.length; ++i) {
      vm.assume(!gfConfig.goList(users[i]));
    }

    grantRole(address(gfConfig), TestConstants.GO_LISTER_ROLE, notGfOwner);
    assertTrue(gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));

    _startImpersonation(notGfOwner);
    gfConfig.bulkAddToGoList(users);

    for (uint256 i = 0; i < users.length; ++i) {
      assertTrue(gfConfig.goList(users[i]));
    }

    gfConfig.bulkRemoveFromGoList(users);
    for (uint256 i = 0; i < users.length; ++i) {
      assertFalse(gfConfig.goList(users[i]));
    }
  }

  function testBulkRemoveFromGoListRevertsForNonOwnerNonGoLister(
    address notGfOwner,
    address[] calldata users
  ) public {
    vm.assume(notGfOwner != GF_OWNER);
    vm.assume(!gfConfig.hasRole(TestConstants.GO_LISTER_ROLE, notGfOwner));
    for (uint256 i = 0; i < users.length; ++i) {
      vm.assume(!gfConfig.goList(users[i]));
    }

    _startImpersonation(GF_OWNER);
    gfConfig.bulkAddToGoList(users);
    for (uint256 i = 0; i < users.length; ++i) {
      assertTrue(gfConfig.goList(users[i]));
    }

    _startImpersonation(notGfOwner);
    vm.expectRevert("Must have go-lister role to perform this action");
    gfConfig.bulkRemoveFromGoList(users);
    for (uint256 i = 0; i < users.length; ++i) {
      assertTrue(gfConfig.goList(users[i]));
    }
  }
}

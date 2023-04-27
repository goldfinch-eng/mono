// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {AccessControl} from "../../cake/AccessControl.sol";
import {IAccessControl} from "../../interfaces/IAccessControl.sol";

contract AccessControlTest is Test {
  AccessControl private accessControl;

  address private resource = address(1);
  address private superAdmin;

  event AdminSet(address indexed resource, address indexed admin);

  function setUp() public {
    superAdmin = address(this);
    vm.label(resource, "resource");
    vm.label(superAdmin, "superAdmin");

    accessControl = new AccessControl();
    accessControl.initialize(superAdmin);
  }

  function testSetAdminSetsAdminForResource(address admin) public {
    accessControl.setAdmin(resource, admin);
    assertEq(accessControl.admins(resource), admin);
  }

  function testInitializerEmitsEvent() public {
    AccessControl newAccessControl = new AccessControl();
    vm.expectEmit(true, false, false, false);
    emit AdminSet(address(newAccessControl), superAdmin);
    newAccessControl.initialize(superAdmin);
  }

  function testSetAdminEmitsEvent(address admin) public {
    vm.expectEmit(true, false, false, false);
    emit AdminSet(resource, admin);
    accessControl.setAdmin(resource, admin);
  }

  function testRequireAdminSucceedsForAdmin(address admin) public {
    vm.assume(admin != address(0));

    accessControl.setAdmin(resource, admin);

    accessControl.requireAdmin(resource, admin);
  }

  function testRequireAdminRevertsForZeroAddress() public {
    vm.expectRevert(abi.encodeWithSelector(IAccessControl.ZeroAddress.selector));
    accessControl.requireAdmin(resource, address(0));
  }

  function testRequireAdminRevertsForNonAdmin(address admin, address someOtherAddress) public {
    vm.assume(someOtherAddress != address(0) && someOtherAddress != admin);

    accessControl.setAdmin(resource, admin);
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.RequiresAdmin.selector, resource, someOtherAddress)
    );
    accessControl.requireAdmin(resource, someOtherAddress);
  }

  function testRequireSuperAdminSucceedsForAdminOfAccessControlContract() public view {
    accessControl.requireSuperAdmin(superAdmin);
  }

  function testRequireSuperAdminRevertsForZeroAddress() public {
    vm.expectRevert(abi.encodeWithSelector(IAccessControl.ZeroAddress.selector));
    accessControl.requireSuperAdmin(address(0));
  }

  function testRequireSuperAdminRevertsForNonSuperAdmin(address someOtherAddress) public {
    vm.assume(someOtherAddress != address(0) && someOtherAddress != superAdmin);

    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.RequiresAdmin.selector,
        address(accessControl),
        someOtherAddress
      )
    );
    accessControl.requireSuperAdmin(someOtherAddress);
  }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";

import {Context} from "../../cake/Context.sol";
import {IAccessControl} from "../../interfaces/IAccessControl.sol";
import {AccessControl} from "../../cake/AccessControl.sol";

import {Router} from "../../cake/Router.sol";
import {IRouter} from "../../interfaces/IRouter.sol";
import "../../cake/Routing.sol" as Routing;

import {CakeHelper} from "./helpers/CakeHelper.t.sol";

contract RouterTest is Test {
  CakeHelper private cake;
  Router private router;

  address private someAddress = 0x0000000000000000000000000000000000000001;
  address private someOtherAddress = 0x0000000000000000000000000000000000000002;

  event SetContract(bytes4 indexed key, address indexed addr);

  function setUp() public {
    cake = new CakeHelper(address(this));
    router = cake.router();
  }

  function testSetContractRevertsForNonAdmin() public {
    vm.startPrank(someAddress);
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.RequiresAdmin.selector, address(router), someAddress)
    );
    router.setContract(Routing.Keys.AccessControl, someOtherAddress);
  }

  function testSetContractSetsMapping() public {
    vm.expectEmit(true, false, false, false);
    emit SetContract(Routing.Keys.AccessControl, someOtherAddress);
    router.setContract(Routing.Keys.AccessControl, someOtherAddress);
    assertEq(router.contracts(Routing.Keys.AccessControl), someOtherAddress);
  }

  function testInitializerOneTime() public {
    AccessControl accessControl = cake.accessControl();
    vm.expectRevert("Initializable: contract is already initialized");
    router.initialize(accessControl);
  }
}

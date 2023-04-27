// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {Test} from "forge-std/Test.sol";
import {console2 as console} from "forge-std/console2.sol";

import {Context} from "../../cake/Context.sol";
import {AccessControl} from "../../cake/AccessControl.sol";

import {CakeHelper} from "./helpers/CakeHelper.t.sol";

contract ContextTest is Test {
  CakeHelper private cake;
  Context private context;

  address private msgSender = 0x0000000000000000000000000000000000000001;
  address private someOtherAddress = 0x0000000000000000000000000000000000000002;

  function setUp() public {
    cake = new CakeHelper(address(this));
    context = cake.context();
  }

  function testConstructorSetsRouter() public {
    assertFalse(address(context.router()) == address(0));
  }
}

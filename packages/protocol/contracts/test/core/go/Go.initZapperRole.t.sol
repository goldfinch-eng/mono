// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoBaseTest} from "./BaseGo.t.sol";
import {TestConstants} from "../TestConstants.t.sol";

contract GoInitZapperRoleTest is GoBaseTest {
  function testInitZapperRoleRevertsForNonAdmin(
    address notGfOwner
  ) public impersonating(notGfOwner) {
    vm.assume(notGfOwner != GF_OWNER);
    vm.expectRevert("Must have admin role to perform this action");
    go.initZapperRole();
  }

  function testInitZapperRoleInitializesZapperRole(
    address notGfOwner
  ) public impersonating(GF_OWNER) {
    vm.assume(notGfOwner != GF_OWNER);
    // After the zapper role is initialized the owner can grant it to others
    go.initZapperRole();
    assertFalse(go.hasRole(TestConstants.ZAPPER_ROLE, notGfOwner));
    go.grantRole(TestConstants.ZAPPER_ROLE, notGfOwner);
    assertTrue(go.hasRole(TestConstants.ZAPPER_ROLE, notGfOwner));
  }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";

contract UniqueIdentitySetSupportedUidTypesTest is UniqueIdentityBaseTest {
  function testAdminCanSetSupportedUidTypes() public impersonating(GF_OWNER) {
    uint256[] memory uidTypes = new uint256[](2);
    uidTypes[0] = 6;
    uidTypes[1] = 7;
    bool[] memory values = new bool[](2);
    values[0] = true;
    values[1] = false;
    assertFalse(uid.supportedUIDTypes(6));
    assertFalse(uid.supportedUIDTypes(7));
    uid.setSupportedUIDTypes(uidTypes, values);
    assertTrue(uid.supportedUIDTypes(6));
    assertFalse(uid.supportedUIDTypes(7));
  }

  function testCantSupportedUidTypesIfTypesAndValuesLengthMismatch(
    uint256[] calldata uidTypes,
    bool[] calldata values
  ) public impersonating(GF_OWNER) {
    vm.assume(uidTypes.length != values.length);
    vm.expectRevert("accounts and ids length mismatch");
    uid.setSupportedUIDTypes(uidTypes, values);
  }

  function testNotAdminCantSetSupportedUidTypes(
    address notAdmin
  ) public onlyAllowListed(notAdmin) impersonating(notAdmin) {
    vm.expectRevert("Must have admin role to perform this action");
    uint256[] memory uidTypes = new uint256[](0);
    bool[] memory values = new bool[](0);
    uid.setSupportedUIDTypes(uidTypes, values);
  }
}

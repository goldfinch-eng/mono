// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoBaseTest} from "./BaseGo.t.sol";

contract GoGoOnlyIdTypesTest is GoBaseTest {
  function testGoOnlyIdTypesValidatesZeroAddress() public {
    uint256[] memory empty = new uint256[](0);
    vm.expectRevert("Zero address is not go-listed");
    go.goOnlyIdTypes(address(0), empty);
  }

  function testGoOnlyIdTypesReturnsTrueIfHasUidAndNotLegacyGoListed(
    address user,
    uint256 validUidType
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    vm.assume(user != address(protocol.stakingRewards()));
    validUidType = bound(validUidType, 0, 4);
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = validUidType;

    assertFalse(go.goOnlyIdTypes(user, uidTypes));

    uniqueIdentity._mintForTest(user, validUidType, 1, bytes(""));

    assertTrue(go.goOnlyIdTypes(user, uidTypes));
  }

  function testGoOnlyIdTypesReturnsTrueIfGoListedWithNoUid(
    address user
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = 0;
    gfConfig.addToGoList(user);
    assertTrue(go.goOnlyIdTypes(user, uidTypes));
  }

  function testGoOnlyIdTypesReturnsFalseIfNotGoListedAndNoUid(
    address user
  ) public onlyAllowListed(user) {
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = 0;
    assertFalse(go.goOnlyIdTypes(user, uidTypes));
  }
}

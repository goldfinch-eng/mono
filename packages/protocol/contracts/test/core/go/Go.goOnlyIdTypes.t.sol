// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoBaseTest} from "./BaseGo.t.sol";

contract GoGoOnlyIdTypesTest is GoBaseTest {
  function testValidatesZeroAddress() public {
    uint256[] memory empty = new uint256[](0);
    vm.expectRevert("Zero address is not go-listed");
    go.goOnlyIdTypes(address(0), empty);
  }

  function testNoUidOnLegacyGoListReturnsTrueForUidType0(
    address user
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = 0;
    gfConfig.addToGoList(user);
    assertTrue(go.goOnlyIdTypes(user, uidTypes));
  }

  function testNoUidOnLegacyGoListReturnsFalseForUidTypeGt0(
    address user,
    uint256 uidType
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    vm.assume(uidType > 0);
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = uidType;
    gfConfig.addToGoList(user);
    assertFalse(go.goOnlyIdTypes(user, uidTypes));
  }

  function testHasUid0OnLegacyGoListAnd0IsValidUidReturnsTrue(
    address user
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    uid._mintForTest(user, 0, 1, "");
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = 0;
    gfConfig.addToGoList(user);
    assertTrue(go.goOnlyIdTypes(user, uidTypes));
  }

  function testWhenCallerHasValidUidReturnTrue(
    address user,
    uint256 uidType
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    uidType = bound(uidType, 0, 4); // Bound within range of valid uids

    uid._mintForTest(user, uidType, 1, "");
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = uidType;
    assertTrue(go.goOnlyIdTypes(user, uidTypes));
  }

  function testCallerHasUidAndDifferentUidTypeInListReturnsFalse(
    address user,
    uint256 uidType,
    uint256 queryUidType
  ) public onlyAllowListed(user) {
    uidType = bound(uidType, 0, 4); // Bound within range of valid uids
    vm.assume(uidType != queryUidType);

    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = queryUidType;

    assertFalse(go.goOnlyIdTypes(user, uidTypes));
  }

  function testWhenOriginHasValidUidAndOperatorIsApprovedReturnsTrue(
    address user,
    uint256 uidType,
    address operator
  ) public onlyAllowListed(user) onlyAllowListed(operator) {
    vm.assume(user != operator);
    uidType = bound(uidType, 0, 4); // Bound within range of valid uids

    uid._mintForTest(user, uidType, 1, "");

    _startImpersonation(user, user);
    uid.setApprovalForAll(operator, true);
    assertTrue(uid.isApprovedForAll(user, operator));

    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = uidType;
    assertTrue(go.goOnlyIdTypes(operator, uidTypes));
  }

  function testWhenOriginHasInvalidUidAndOperatorIsApprovedReturnFalse(
    address user,
    address operator,
    uint256 uidType,
    uint256 queryUidType
  ) public onlyAllowListed(user) onlyAllowListed(operator) {
    vm.assume(uidType > 0);
    uidType = bound(uidType, 0, 4); // Bound within range of valid uids
    vm.assume(uidType != queryUidType);
    vm.assume(user != operator);

    uid._mintForTest(user, uidType, 1, "");

    _startImpersonation({sender: user, origin: user});
    uid.setApprovalForAll(operator, true);
    assertTrue(uid.isApprovedForAll(user, operator));

    // Use a different uidType
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = queryUidType;
    assertFalse(go.goOnlyIdTypes(operator, uidTypes));
  }

  function testWhenOriginHasValidUidAndOperatorNotApprovedReturnFalse(
    address user,
    address notOperator,
    uint256 uidType
  ) public onlyAllowListed(user) onlyAllowListed(notOperator) {
    uidType = bound(uidType, 0, 4);
    vm.assume(user != notOperator);
    uid._mintForTest(user, uidType, 1, "");

    assertFalse(uid.isApprovedForAll(user, notOperator));

    _startImpersonation({sender: user, origin: user});
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = uidType;
    assertFalse(go.goOnlyIdTypes(notOperator, uidTypes));
  }

  function testHasValidUidAndNotLegacyGoListedReturnsTrue(
    address user,
    uint256 validUidType
  ) public onlyAllowListed(user) impersonating(GF_OWNER) {
    vm.assume(user != address(protocol.stakingRewards()));
    validUidType = bound(validUidType, 0, 4);
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = validUidType;

    assertFalse(go.goOnlyIdTypes(user, uidTypes));

    uid._mintForTest(user, validUidType, 1, bytes(""));

    assertTrue(go.goOnlyIdTypes(user, uidTypes));
  }

  function testNoUidAndNotLegacyGoListedReturnsFalse(address user) public onlyAllowListed(user) {
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = 0;
    assertFalse(go.goOnlyIdTypes(user, uidTypes));
  }
}

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoBaseTest} from "./BaseGo.t.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {FuzzingHelper} from "../../helpers/FuzzingHelper.t.sol";

contract GoGoTest is GoBaseTest {
  function testGoUsesLegacyGoListWhenSet(
    address legacyGoListedUser
  ) public onlyAllowListed(legacyGoListedUser) impersonating(GF_OWNER) {
    GoldfinchConfig legacyGoList = new GoldfinchConfig();
    legacyGoList.initialize(GF_OWNER);
    legacyGoList.addToGoList(legacyGoListedUser);

    assertFalse(go.go(legacyGoListedUser));
    go.setLegacyGoList(legacyGoList);
    assertTrue(go.go(legacyGoListedUser));
  }

  function testGoRejectsZeroAddress() public impersonating(GF_OWNER) {
    vm.expectRevert("Zero address is not go-listed");
    go.go(address(0));
  }

  function testGoListedUserWithNoUidIsGoListed(
    address legacyUser
  ) public onlyAllowListed(legacyUser) impersonating(GF_OWNER) {
    vm.assume(!go.go(legacyUser));
    gfConfig.addToGoList(legacyUser);
    assertTrue(go.go(legacyUser));
  }

  function testNonGoListedUserWithNoUidIsNotGoListed(address user) public onlyAllowListed(user) {
    assertFalse(go.go(user));
  }

  function testNonGoListedUserWithValidUidIsGoListed(
    address user,
    uint256 validUidType
  ) public onlyAllowListed(user) {
    validUidType = bound(validUidType, 0, 4);
    uid._mintForTest(user, validUidType, 1, bytes(""));
    assertTrue(go.go(user));
  }

  function testGoListedUserWithValidUidIsGoListed(
    address user,
    uint256 validUidType
  ) public impersonating(GF_OWNER) onlyAllowListed(user) {
    validUidType = bound(validUidType, 0, 4);
    uid._mintForTest(user, validUidType, 1, bytes(""));
    gfConfig.addToGoList(user);
    assertTrue(go.go(user));
  }
}

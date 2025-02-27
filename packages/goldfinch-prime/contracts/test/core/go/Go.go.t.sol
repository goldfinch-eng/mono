// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {GoBaseTest} from "./BaseGo.t.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";
import {FuzzingHelper} from "../../helpers/FuzzingHelper.t.sol";

contract GoGoTest is GoBaseTest {
  function testGoRejectsZeroAddress() public impersonating(GF_OWNER) {
    vm.expectRevert("Zero address is not go-listed");
    go.go(address(0));
  }

  function testUserWithoutUidIsNotAuthorized(address user) public view onlyAllowListed(user) {
    assertFalse(go.go(user));
  }

  function testUserWithValidUidIsAuthorized(
    address user,
    uint256 validUidType
  ) public onlyAllowListed(user) {
    validUidType = bound(validUidType, 0, 4);
    uid._mintForTest(user, validUidType, 1, bytes(""));
    assertTrue(go.go(user));
  }
}

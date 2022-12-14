// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";

contract UniqueIdentitySetUriTest is UniqueIdentityBaseTest {
  function testAdminCanSetURI(
    string memory newURI,
    uint256 tokenId
  ) public impersonating(GF_OWNER) {
    uid.setURI(newURI);
    assertEq(uid.uri(tokenId), newURI);
  }

  function testAdminCanSetURIWhenPaused(
    string memory newURI,
    uint256 tokenId
  ) public impersonating(GF_OWNER) {
    uid.pause();
    assertTrue(uid.paused());
    uid.setURI(newURI);
    assertEq(uid.uri(tokenId), newURI);
  }

  function testNonAdminCantSetURI(
    address notAdmin,
    string memory newURI
  ) public onlyAllowListed(notAdmin) impersonating(notAdmin) {
    vm.expectRevert("Must have admin role to perform this action");
    uid.setURI(newURI);
  }
}

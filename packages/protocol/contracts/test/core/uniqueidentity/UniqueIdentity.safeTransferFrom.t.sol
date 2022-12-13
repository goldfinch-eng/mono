// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";

contract UniqueIdentitySafeTransferFromTest is UniqueIdentityBaseTest {
  function testRevertsForTokenOwner(
    address uidHolder,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(recipient) impersonating(uidHolder) {
    mint({recipient: uidHolder, uidType: 0, amount: 1});
    vm.expectRevert("Only mint or burn transfers are allowed");
    uid.safeTransferFrom(uidHolder, recipient, 0, 1, "");
  }

  function testRevertsForTokenOwnerWhenPaused(
    address uidHolder,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(recipient) {
    mint({recipient: uidHolder, uidType: 0, amount: 1});
    _startImpersonation(GF_OWNER);
    uid.pause();
    _startImpersonation(uidHolder);
    vm.expectRevert("Only mint or burn transfers are allowed");
    uid.safeTransferFrom(uidHolder, recipient, 0, 1, "");
  }

  function testRevertsForApprovedOperator(
    address uidHolder,
    address operator,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(operator) onlyAllowListed(recipient) {
    vm.assume(uidHolder != operator);
    mint({recipient: uidHolder, uidType: 0, amount: 1});

    _startImpersonation(uidHolder);
    uid.setApprovalForAll(operator, true);
    assertTrue(uid.isApprovedForAll(uidHolder, operator));

    _startImpersonation(operator);
    vm.expectRevert("Only mint or burn transfers are allowed");
    uid.safeTransferFrom(uidHolder, recipient, 0, 1, "");
  }

  function testRevertsForApprovedOperatorWhenPaused(
    address uidHolder,
    address operator,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(operator) onlyAllowListed(recipient) {
    vm.assume(uidHolder != operator);
    mint({recipient: uidHolder, uidType: 0, amount: 1});

    _startImpersonation(uidHolder);
    uid.setApprovalForAll(operator, true);
    assertTrue(uid.isApprovedForAll(uidHolder, operator));

    _startImpersonation(GF_OWNER);
    uid.pause();
    assertTrue(uid.paused());

    _startImpersonation(operator);
    vm.expectRevert("Only mint or burn transfers are allowed");
    uid.safeTransferFrom(uidHolder, recipient, 0, 1, "");
  }
}

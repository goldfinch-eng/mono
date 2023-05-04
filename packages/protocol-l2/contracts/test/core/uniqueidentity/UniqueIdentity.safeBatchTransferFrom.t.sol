// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {TestUniqueIdentity} from "../../TestUniqueIdentity.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {UniqueIdentityBaseTest} from "./BaseUniqueIdentity.t.sol";

contract UniqueIdentitySafeBatchTransferFromTest is UniqueIdentityBaseTest {
  function testRevertsForTokenOwner(
    address uidHolder,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(recipient) impersonating(uidHolder) {
    uid._mintForTest(uidHolder, 0, 1, "");
    vm.expectRevert("Only mint or burn transfers are allowed");
    batchTransfer(uidHolder, uidHolder, recipient, 0, 1);
  }

  function testRevertsForTokenOwnerWhenPaused(
    address uidHolder,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(recipient) {
    uid._mintForTest(uidHolder, 0, 1, "");
    _startImpersonation(GF_OWNER);
    uid.pause();

    vm.expectRevert("Only mint or burn transfers are allowed");
    batchTransfer(uidHolder, uidHolder, recipient, 0, 1);
  }

  function testRevertsForApprovedOperator(
    address uidHolder,
    address operator,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(operator) onlyAllowListed(recipient) {
    vm.assume(uidHolder != operator);
    uid._mintForTest(uidHolder, 0, 1, "");

    _startImpersonation(uidHolder);
    uid.setApprovalForAll(operator, true);
    assertTrue(uid.isApprovedForAll(uidHolder, operator));

    vm.expectRevert("Only mint or burn transfers are allowed");
    batchTransfer(uidHolder, operator, recipient, 0, 1);
  }

  function testRevertsForApprovedOperatorWhenPaused(
    address uidHolder,
    address operator,
    address recipient
  ) public onlyAllowListed(uidHolder) onlyAllowListed(operator) onlyAllowListed(recipient) {
    vm.assume(uidHolder != operator);
    uid._mintForTest(uidHolder, 0, 1, "");

    _startImpersonation(uidHolder);
    uid.setApprovalForAll(operator, true);
    assertTrue(uid.isApprovedForAll(uidHolder, operator));

    _startImpersonation(GF_OWNER);
    uid.pause();
    assertTrue(uid.paused());

    vm.expectRevert("Only mint or burn transfers are allowed");
    batchTransfer(uidHolder, operator, recipient, 0, 1);
  }

  function batchTransfer(
    address tokenOwner,
    address from,
    address to,
    uint256 uidType,
    uint256 amount
  ) internal impersonating(from) {
    uint256[] memory uidTypes = new uint256[](1);
    uidTypes[0] = uidType;
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amount;
    uid.safeBatchTransferFrom(tokenOwner, to, uidTypes, amounts, "");
  }
}

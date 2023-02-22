// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSetters is CallableLoanBaseTest {
  function testSetLimitReverts(uint256 limit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.expectRevert(bytes("US"));
    callableLoan.setLimit(limit);
  }

  function testSetMaxLimitReverts(uint256 limit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.expectRevert(bytes("US"));
    callableLoan.setMaxLimit(limit);
  }

  function testSetAllowedUidTypesRevertsForNonLocker(address user) public impersonating(user) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    uint256[] memory ids = new uint256[](0);
    vm.expectRevert(bytes("NA"));
    callableLoan.setAllowedUIDTypes(ids);
  }

  function testSetAllowedUidTypesRevertsIfCapitalDeposited(
    address user,
    uint256 numSlices
  ) public impersonating(BORROWER) {
    numSlices = bound(numSlices, 1, 5);
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    uid._mintForTest(user, 1, 1, "");
    deposit(callableLoan, 3, usdcVal(1), user);

    uint256[] memory newIds = new uint256[](0);
    vm.expectRevert(bytes("AF"));
    callableLoan.setAllowedUIDTypes(newIds);

    // Cannot set uids if there is junior + senior capital
    depositAndDrawdown(callableLoan, usdcVal(4));
    vm.expectRevert(bytes("AF"));
    callableLoan.setAllowedUIDTypes(newIds);
  }

  function testSetAllowedUidTypesSucceedsForLocker(
    uint256[] memory ids
  ) public impersonating(BORROWER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    callableLoan.setAllowedUIDTypes(ids);
    for (uint256 i = 0; i < ids.length; ++i) {
      assertEq(ids[i], callableLoan.allowedUIDTypes(i));
    }
  }

  // TODO
  function testPauseDrawdowns() public impersonating(BORROWER) {}

  // TODO
  function testSetFundableAt() public impersonating(BORROWER) {}
}

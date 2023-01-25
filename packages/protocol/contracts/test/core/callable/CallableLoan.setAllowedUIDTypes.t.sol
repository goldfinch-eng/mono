// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSetAllowedUIDTypesTest is CallableLoanBaseTest {
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
    deposit(callableLoan, 2, usdcVal(1), user);

    uint256[] memory newIds = new uint256[](0);
    vm.expectRevert("has balance");
    callableLoan.setAllowedUIDTypes(newIds);

    callableLoan.lockJuniorCapital();

    // Cannot set uids if there is junior + senior capital
    seniordepositAndDrawdown(callableLoan, usdcVal(4));
    vm.expectRevert("has balance");
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
}

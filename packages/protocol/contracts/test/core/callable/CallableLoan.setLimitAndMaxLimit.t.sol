// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSetLimitAndMaxLimitTest is CallableLoanBaseTest {
  function testSetLimitRevertsForNonAdmin(
    address notAdmin,
    uint256 limit
  ) public impersonating(notAdmin) {
    vm.assume(notAdmin != GF_OWNER);
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.expectRevert("Must have admin role to perform this action");
    callableLoan.setLimit(limit);
  }

  function testSetLimitUpdatesLimitUpToMaxLimit(
    uint256 maxLimit,
    uint256 limit
  ) public impersonating(GF_OWNER) {
    limit = bound(limit, 0, maxLimit);
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    callableLoan.setMaxLimit(maxLimit);
    callableLoan.setLimit(limit);
    assertEq(cl.limit(), limit);
  }

  function testSetLimitRevertsIfLimitGtMaxLimit(uint256 limit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    limit = bound(limit, cl.maxLimit() + 1, type(uint256).max);
    vm.expectRevert("Cannot be more than the max limit");
    callableLoan.setLimit(limit);
  }

  function testSetMaxLimitRevertsForNonAdmin(
    address notAdmin,
    uint256 maxLimit
  ) public impersonating(notAdmin) {
    vm.assume(notAdmin != GF_OWNER);
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.expectRevert("Must have admin role to perform this action");
    callableLoan.setMaxLimit(maxLimit);
  }

  function testSetMaxLimitUpdatesMaxLimit(uint256 maxLimit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    callableLoan.setMaxLimit(maxLimit);
    assertEq(maxLimit, cl.maxLimit());
  }
}

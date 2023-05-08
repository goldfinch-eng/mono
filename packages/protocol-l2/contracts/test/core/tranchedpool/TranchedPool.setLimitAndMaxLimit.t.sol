// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolSetLimitAndMaxLimitTest is TranchedPoolBaseTest {
  function testSetLimitRevertsForNonAdmin(
    address notAdmin,
    uint256 limit
  ) public impersonating(notAdmin) {
    vm.assume(notAdmin != GF_OWNER);
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.expectRevert("Must have admin role to perform this action");
    pool.setLimit(limit);
  }

  function testSetLimitUpdatesLimitUpToMaxLimit(
    uint256 maxLimit,
    uint256 limit
  ) public impersonating(GF_OWNER) {
    limit = bound(limit, 0, maxLimit);
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    pool.setMaxLimit(maxLimit);
    pool.setLimit(limit);
    assertEq(cl.limit(), limit);
  }

  function testSetLimitRevertsIfLimitGtMaxLimit(uint256 limit) public impersonating(GF_OWNER) {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    limit = bound(limit, cl.maxLimit() + 1, type(uint256).max);
    vm.expectRevert("Cannot be more than the max limit");
    pool.setLimit(limit);
  }

  function testSetMaxLimitRevertsForNonAdmin(
    address notAdmin,
    uint256 maxLimit
  ) public impersonating(notAdmin) {
    vm.assume(notAdmin != GF_OWNER);
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.expectRevert("Must have admin role to perform this action");
    pool.setMaxLimit(maxLimit);
  }

  function testSetMaxLimitUpdatesMaxLimit(uint256 maxLimit) public impersonating(GF_OWNER) {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    pool.setMaxLimit(maxLimit);
    assertEq(maxLimit, cl.maxLimit());
  }
}

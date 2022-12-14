// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";

contract TranchedPoolV2SetLimitAndMaxLimitTest is TranchedPoolV2BaseTest {
  function testSetLimitRevertsForNonAdmin(
    address notAdmin,
    uint256 limit
  ) public impersonating(notAdmin) {
    vm.assume(notAdmin != GF_OWNER);
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    vm.expectRevert("Must have admin role to perform this action");
    pool.setLimit(limit);
  }

  function testSetLimitUpdatesLimitUpToMaxLimit(
    uint256 maxLimit,
    uint256 limit
  ) public impersonating(GF_OWNER) {
    limit = bound(limit, 0, maxLimit);
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    pool.setMaxLimit(maxLimit);
    pool.setLimit(limit);
    assertEq(cl.limit(), limit);
  }

  function testSetLimitRevertsIfLimitGtMaxLimit(uint256 limit) public impersonating(GF_OWNER) {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    limit = bound(limit, cl.maxLimit() + 1, type(uint256).max);
    vm.expectRevert("Cannot be more than the max limit");
    pool.setLimit(limit);
  }

  function testSetMaxLimitRevertsForNonAdmin(
    address notAdmin,
    uint256 maxLimit
  ) public impersonating(notAdmin) {
    vm.assume(notAdmin != GF_OWNER);
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    vm.expectRevert("Must have admin role to perform this action");
    pool.setMaxLimit(maxLimit);
  }

  function testSetMaxLimitUpdatesMaxLimit(uint256 maxLimit) public impersonating(GF_OWNER) {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    pool.setMaxLimit(maxLimit);
    assertEq(maxLimit, cl.maxLimit());
  }
}

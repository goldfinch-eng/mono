// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";

contract TranchedPoolV2SetAllowedUIDTypesTest is TranchedPoolV2BaseTest {
  function testSetAllowedUidTypesRevertsForNonLocker(address user) public impersonating(user) {
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    vm.assume(fuzzHelper.isAllowed(user));
    uint256[] memory ids = new uint256[](0);
    vm.expectRevert(bytes("NA"));
    pool.setAllowedUIDTypes(ids);
  }

  function testSetAllowedUidTypesRevertsIfCapitalDeposited(
    address user,
    uint256 numSlices
  ) public impersonating(BORROWER) {
    numSlices = bound(numSlices, 1, 5);
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    vm.assume(fuzzHelper.isAllowed(user));
    // Skip a random number of slices and then deposit in the final slice initialized
    // to verify that setting the UIDs is reject if ANY slice has capital
    for (uint256 i = 0; i < numSlices - 1; ++i) {
      pool.lockJuniorCapital();
      pool.lockPool();
      pool.initializeNextSlice(block.timestamp);
    }

    // Cannot set uids if there is junior capital
    uid._mintForTest(user, 1, 1, "");
    deposit(pool, numSlices * 2, usdcVal(1), user);
    uint256[] memory newIds = new uint256[](0);
    vm.expectRevert("has balance");
    pool.setAllowedUIDTypes(newIds);

    pool.lockJuniorCapital();

    // Cannot set uids if there is junior + senior capital
    seniorDepositAndInvest(pool, usdcVal(4));
    vm.expectRevert("has balance");
    pool.setAllowedUIDTypes(newIds);
  }

  function testSetAllowedUidTypesSucceedsForLocker(
    uint256[] memory ids
  ) public impersonating(BORROWER) {
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    pool.setAllowedUIDTypes(ids);
    for (uint256 i = 0; i < ids.length; ++i) {
      assertEq(ids[i], pool.allowedUIDTypes(i));
    }
  }
}

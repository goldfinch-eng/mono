// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {PoolTokens} from "../../../protocol/core/PoolTokens.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolSetAllowedUIDTypesTest is TranchedPoolBaseTest {
  function testSetAllowedUidTypesRevertsForNonLocker(address user) public impersonating(user) {
    (TranchedPool pool, ) = defaultTranchedPool();
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
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.assume(fuzzHelper.isAllowed(user));
    uid._mintForTest(user, 1, 1, "");
    deposit(pool, 2, usdcVal(1), user);

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
    (TranchedPool pool, ) = defaultTranchedPool();
    pool.setAllowedUIDTypes(ids);
    for (uint256 i = 0; i < ids.length; ++i) {
      assertEq(ids[i], pool.allowedUIDTypes(i));
    }
  }
}

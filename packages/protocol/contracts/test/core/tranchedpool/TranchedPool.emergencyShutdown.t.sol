// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolEmergencyShutdownTest is TranchedPoolBaseTest {
  function testPausesAndSweepsFunds() public impersonating(GF_OWNER) {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    usdc.transfer(address(pool), usdcVal(5));
    usdc.transfer(address(cl), usdcVal(3));
    pool.emergencyShutdown();
    assertZero(usdc.balanceOf(address(pool)));
    assertZero(usdc.balanceOf(address(pool.creditLine())));
    assertEq(usdc.balanceOf(TREASURY), usdcVal(8));
    assertTrue(pool.paused());
  }

  function testRevertsForNonAdmin(address notAdmin) public impersonating(notAdmin) {
    (TranchedPool pool, ) = defaultTranchedPool();
    vm.assume(notAdmin != GF_OWNER);
    vm.expectRevert("Must have admin role to perform this action");
    pool.emergencyShutdown();
  }
}

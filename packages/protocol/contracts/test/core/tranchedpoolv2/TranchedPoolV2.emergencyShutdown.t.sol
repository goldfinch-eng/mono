// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";

contract TranchedPoolV2EmergencyShutdownTest is TranchedPoolV2BaseTest {
  function testPausesAndSweepsFunds() public impersonating(GF_OWNER) {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    usdc.transfer(address(pool), usdcVal(5));
    usdc.transfer(address(cl), usdcVal(3));
    pool.emergencyShutdown();
    assertZero(usdc.balanceOf(address(pool)));
    assertZero(usdc.balanceOf(address(pool.creditLine())));
    assertEq(usdc.balanceOf(TREASURY), usdcVal(8));
    assertTrue(pool.paused());
  }

  function testRevertsForNonAdmin(address notAdmin) public impersonating(notAdmin) {
    (TranchedPoolV2 pool, ) = defaultTranchedPool();
    vm.assume(notAdmin != GF_OWNER);
    vm.expectRevert("Must have admin role to perform this action");
    pool.emergencyShutdown();
  }
}

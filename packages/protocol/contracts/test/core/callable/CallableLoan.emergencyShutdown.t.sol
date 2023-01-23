// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanEmergencyShutdownTest is CallableLoanBaseTest {
  function testPausesAndSweepsFunds() public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    usdc.transfer(address(callableLoan), usdcVal(5));
    usdc.transfer(address(cl), usdcVal(3));
    callableLoan.emergencyShutdown();
    assertZero(usdc.balanceOf(address(callableLoan)));
    assertZero(usdc.balanceOf(address(callableLoan.creditLine())));
    assertEq(usdc.balanceOf(TREASURY), usdcVal(8));
    assertTrue(callableLoan.paused());
  }

  function testRevertsForNonAdmin(address notAdmin) public impersonating(notAdmin) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(notAdmin != GF_OWNER);
    vm.expectRevert("Must have admin role to perform this action");
    callableLoan.emergencyShutdown();
  }
}

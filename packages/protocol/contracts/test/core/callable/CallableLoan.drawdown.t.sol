// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";
import {CallableLoanConfigHelper} from "../../../protocol/core/callable/CallableLoanConfigHelper.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {console2 as console} from "forge-std/console2.sol";

contract CallableLoanDrawdownTest is CallableLoanBaseTest {
  using CallableLoanConfigHelper for IGoldfinchConfig;

  function testDrawdownBeforeDepositsFails(
    uint loanLimit,
    uint drawdownAmount
  ) public impersonating(BORROWER) {
    drawdownAmount = bound(drawdownAmount, 1, type(uint).max);
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(loanLimit);
    vm.expectRevert(bytes("ED"));
    callableLoan.drawdown(drawdownAmount);
  }

  function testDrawdownOnlyAvailableToBorrower(
    address user,
    uint depositAmount,
    uint drawdownAmount,
    uint warp1Time,
    uint warp2Time
  ) public {
    vm.assume(user != BORROWER && user != gfConfig.protocolAdminAddress());
    warp1Time = bound(warp1Time, 0, 1000 days);
    warp2Time = bound(warp2Time, 0, 1000 days);
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);

    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");

    vm.warp(block.timestamp + warp1Time);
    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    vm.warp(block.timestamp + warp2Time);
    _startImpersonation(user);
    vm.expectRevert(bytes("NA"));
    callableLoan.drawdown(drawdownAmount);
  }

  function testDrawdownFailsAfterDrawdownPeriod(
    address user,
    uint depositAmount,
    uint drawdownAmount,
    uint failedDrawdownAmount
  ) public impersonating(BORROWER) {
    depositAmount = bound(depositAmount, usdcVal(1), usdcVal(100_000_100));
    drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);
    failedDrawdownAmount = bound(failedDrawdownAmount, 1, type(uint).max);
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
    uid._mintForTest(user, 1, 1, "");

    uint256 token = deposit(callableLoan, 3, depositAmount, user);
    // Starts drawdown period.
    callableLoan.drawdown(drawdownAmount);
    warpToAfterDrawdownPeriod(callableLoan);
    vm.expectRevert(bytes("IS"));
    callableLoan.drawdown(failedDrawdownAmount);
  }
}

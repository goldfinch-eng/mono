// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {console2 as console} from "forge-std/console2.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSubmitCallTest is CallableLoanBaseTest {
  function testDoesNotLetYouSubmitCallForPoolTokenYouDontOwn(
    address poolTokenOwner,
    address rando,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint256 callAmount,
    uint256 secondsElapsedSinceDrawdownPeriod
  ) public {
    vm.assume(rando != poolTokenOwner);
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    // vm.assume after building callable loan to properly exclude contracts.
    vm.assume(fuzzHelper.isAllowed(poolTokenOwner));
    vm.assume(fuzzHelper.isAllowed(rando));

    uid._mintForTest(poolTokenOwner, 1, 1, "");
    uid._mintForTest(rando, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, poolTokenOwner);
    uint256 drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);
    drawdown(callableLoan, drawdownAmount);
    secondsElapsedSinceDrawdownPeriod = bound(
      secondsElapsedSinceDrawdownPeriod,
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS,
      callableLoan.termEndTime()
    );
    vm.warp(block.timestamp + secondsElapsedSinceDrawdownPeriod);
    vm.expectRevert(bytes("NA"));
    submitCall(callableLoan, depositAmount - drawdownAmount, token, rando);
  }

  function testDoesNotLetYouSubmitCallAfterDrawdownBeforeLockupEnds(
    address depositor,
    uint256 depositAmount,
    uint256 drawdownAmount,
    uint callAmount,
    uint256 secondsElapsedSinceDrawdown
  ) public {
    secondsElapsedSinceDrawdown = bound(
      secondsElapsedSinceDrawdown,
      0,
      DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS
    );
    depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
    vm.assume(fuzzHelper.isAllowed(depositor)); // Assume after building callable loan to properly exclude contracts.

    uid._mintForTest(depositor, 1, 1, "");
    uint256 token = deposit(callableLoan, 3, depositAmount, depositor);
    uint256 drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    uint256 callAmount = bound(callAmount, 1, drawdownAmount);
    drawdown(callableLoan, drawdownAmount);
    vm.warp(block.timestamp + secondsElapsedSinceDrawdown);
    vm.expectRevert(bytes("IS"));
    submitCall(callableLoan, callAmount, token, depositor);
  }

  // function testDoesNotLetYouSubmitCallForMorePrincipalOutstandingThanIsAvailable(
  //   address user,
  //   uint256 depositAmount,
  //   uint256 drawdownAmount,
  //   uint256 callAmount,
  //   uint256 secondsElapsed
  // ) public {}

  // function testDoesNotLetYouSubmitCallInLastTranche(
  //   address user,
  //   uint256 depositAmount,
  //   uint256 drawdownAmount,
  //   uint256 callAmount,
  //   uint256 secondsElapsed
  // ) public {
  //   secondsElapsed = bound(secondsElapsed, 0, DEFAULT_DRAWDOWN_PERIOD_IN_SECONDS);
  //   depositAmount = bound(depositAmount, usdcVal(10), usdcVal(100_000_000));
  //   (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLimit(depositAmount);
  //   vm.assume(fuzzHelper.isAllowed(user)); // Assume after building callable loan to properly exclude contracts.
  //   uid._mintForTest(user, 1, 1, "");
  //   uint256 token = deposit(callableLoan, 3, depositAmount, user);
  //   uint256 drawdownAmount = bound(drawdownAmount, 1, depositAmount - 1);
  //   drawdown(callableLoan, drawdownAmount);
  //   vm.warp(block.timestamp + secondsElapsed);
  //   vm.expectRevert(bytes("IS"));
  //   submitCall(callableLoan, depositAmount - drawdownAmount, token, user);
  // }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {IPoolTokens} from "../../../interfaces/IPoolTokens.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanSetters is CallableLoanBaseTest {
  function testSetLimitReverts(uint256 limit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.expectRevert(ICallableLoanErrors.UnsupportedOperation.selector);
    callableLoan.setLimit(limit);
  }

  function testSetMaxLimitReverts(uint256 limit) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    vm.expectRevert(ICallableLoanErrors.UnsupportedOperation.selector);
    callableLoan.setMaxLimit(limit);
  }

  function testSettersRevertsForNonLocker(
    address user,
    uint256 fundableAt
  ) public impersonating(user) {
    vm.assume(user != BORROWER);
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    uint256[] memory ids = new uint256[](0);
    vm.expectRevert(abi.encodeWithSelector(ICallableLoanErrors.RequiresLockerRole.selector, user));
    callableLoan.setAllowedUIDTypes(ids);
    vm.expectRevert(abi.encodeWithSelector(ICallableLoanErrors.RequiresLockerRole.selector, user));
    callableLoan.setFundableAt(fundableAt);
  }

  function testSettersRevertForNonAdmin(
    address user,
    uint256 fundableAt
  ) public impersonating(user) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(user != GF_OWNER);
    vm.expectRevert(bytes("Must have admin role to perform this action"));
    callableLoan.pauseDrawdowns();
    vm.expectRevert(bytes("Must have admin role to perform this action"));
    callableLoan.unpauseDrawdowns();
  }

  function testSetAllowedUidTypesRevertsIfCapitalDeposited(
    address user
  ) public impersonating(BORROWER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    vm.assume(fuzzHelper.isAllowed(user));
    uid._mintForTest(user, 1, 1, "");
    deposit(callableLoan, 3, usdcVal(1), user);

    uint256[] memory newIds = new uint256[](0);
    vm.expectRevert(ICallableLoanErrors.CannotSetAllowedUIDTypesAfterDeposit.selector);
    callableLoan.setAllowedUIDTypes(newIds);

    // Cannot set uids if there is junior + senior capital
    depositAndDrawdown(callableLoan, usdcVal(4));
    vm.expectRevert(ICallableLoanErrors.CannotSetAllowedUIDTypesAfterDeposit.selector);
    callableLoan.setAllowedUIDTypes(newIds);
  }

  function testSetAllowedUidTypesSucceedsForLocker(
    uint256[] memory ids
  ) public impersonating(BORROWER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    callableLoan.setAllowedUIDTypes(ids);
    for (uint256 i = 0; i < ids.length; ++i) {
      assertEq(ids[i], callableLoan.allowedUIDTypes(i));
    }
  }

  function testPauseDrawdowns(
    address user,
    uint256 depositAmount,
    uint256 drawdownAmount
  ) public impersonating(GF_OWNER) {
    (CallableLoan callableLoan, ) = defaultCallableLoan();
    depositAmount = bound(depositAmount, 1, callableLoan.limit());
    drawdownAmount = bound(drawdownAmount, 1, depositAmount);
    callableLoan.pauseDrawdowns();
    assertTrue(callableLoan.drawdownsPaused());

    vm.assume(fuzzHelper.isAllowed(user));
    uid._mintForTest(user, 1, 1, "");
    deposit(callableLoan, 3, depositAmount, user);

    vm.expectRevert(ICallableLoanErrors.CannotDrawdownWhenDrawdownsPaused.selector);
    callableLoan.drawdown(drawdownAmount);

    callableLoan.unpauseDrawdowns();
    assertFalse(callableLoan.drawdownsPaused());
    callableLoan.drawdown(drawdownAmount);
  }

  function testSetFundableAt(
    uint256 originalFundableAtMargin,
    uint256 newFundableAt,
    uint256 fundableAtMargin,
    uint256 attemptedFundableAt
  ) public impersonating(BORROWER) {
    originalFundableAtMargin = bound(originalFundableAtMargin, 1, 10000 days);
    fundableAtMargin = bound(fundableAtMargin, newFundableAt, type(uint256).max);
    (CallableLoan callableLoan, ) = callableLoanBuilder
      .withFundableAt(block.timestamp + originalFundableAtMargin)
      .build(BORROWER);
    callableLoan.setFundableAt(newFundableAt);
    assertEq(callableLoan.getFundableAt(), newFundableAt);

    vm.warp(fundableAtMargin);
    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.CannotSetFundableAtAfterFundableAt.selector,
        newFundableAt
      )
    );
    callableLoan.setFundableAt(attemptedFundableAt);
  }
}

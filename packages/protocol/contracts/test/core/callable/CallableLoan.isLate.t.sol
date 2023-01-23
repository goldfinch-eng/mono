// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";

contract CallableLoanIsLateTest is CallableLoanBaseTest {
  function setUp() public override {
    super.setUp();

    _startImpersonation(GF_OWNER);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays), 10);
    _stopImpersonation();
  }

  function testNotLateIfNoBalance() public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    assertFalse(cl.isLate());

    uint256 limit = usdcVal(100);

    deposit(callableLoan, 2, limit, GF_OWNER);
    lockJuniorTranche(callableLoan);

    seniorDepositAndInvest(callableLoan, limit * 4);
    lockSeniorTranche(callableLoan);

    drawdown(callableLoan, limit);

    pay(callableLoan, cl.interestOwed() + cl.principalOwed() + cl.balance());

    vm.warp(cl.termEndTime());

    assertFalse(cl.isLate());
  }

  function testNotLateIfNotPastDueTime(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    uint256 limit = usdcVal(100);
    deposit(callableLoan, 2, limit, GF_OWNER);
    lockJuniorTranche(callableLoan);
    seniorDepositAndInvest(callableLoan, limit * 4);
    lockSeniorTranche(callableLoan);
    drawdown(callableLoan, limit);

    timestamp = bound(timestamp, block.timestamp, cl.nextDueTime() - 1);

    vm.warp(timestamp);

    assertFalse(cl.isLate());
  }

  function testNotLateIfPastDueTimeButWithinGracePeriod(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    uint256 limit = usdcVal(100);
    deposit(callableLoan, 2, limit, GF_OWNER);
    lockJuniorTranche(callableLoan);
    seniorDepositAndInvest(callableLoan, limit * 4);
    lockSeniorTranche(callableLoan);
    drawdown(callableLoan, limit);

    timestamp = bound(timestamp, cl.nextDueTime(), cl.nextDueTime() + (10 days));

    vm.warp(timestamp);

    assertFalse(cl.isLate());
  }

  function testLateIfPastDueTimeAndPastGracePeriod(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    uint256 limit = usdcVal(100);
    deposit(callableLoan, 2, limit, GF_OWNER);
    lockJuniorTranche(callableLoan);
    seniorDepositAndInvest(callableLoan, limit * 4);
    lockSeniorTranche(callableLoan);
    drawdown(callableLoan, limit);

    timestamp = bound(timestamp, cl.nextDueTime() + (10 days) + 1, cl.termEndTime());

    vm.warp(timestamp);

    assertTrue(cl.isLate());
  }

  function testIsNotLateIfCurrentAtTermEndTimeAndInGracePeriod(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    uint256 limit = usdcVal(100);
    deposit(callableLoan, 2, limit, GF_OWNER);
    lockJuniorTranche(callableLoan);
    seniorDepositAndInvest(callableLoan, limit * 4);
    lockSeniorTranche(callableLoan);
    drawdown(callableLoan, limit);

    // Advance to the last payment period and pay back interes
    for (uint i = 0; i < 11; ++i) {
      vm.warp(cl.nextDueTime());
      pay(callableLoan, cl.interestOwed());
    }

    assertEq(cl.nextDueTime(), cl.termEndTime());

    timestamp = bound(timestamp, cl.termEndTime(), cl.termEndTime() + (10 days));
    vm.warp(timestamp);

    assertFalse(cl.isLate());
  }

  function testIsLateIfCurrentAtTermEndTimeAndAfterGracePeriod(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    uint256 limit = usdcVal(100);
    deposit(callableLoan, 2, limit, GF_OWNER);
    lockJuniorTranche(callableLoan);
    seniorDepositAndInvest(callableLoan, limit * 4);
    lockSeniorTranche(callableLoan);
    drawdown(callableLoan, limit);

    // Advance to the last payment period and pay back interes
    for (uint i = 0; i < 11; ++i) {
      vm.warp(cl.nextDueTime());
      pay(callableLoan, cl.interestOwed());
    }

    assertEq(cl.nextDueTime(), cl.termEndTime());

    timestamp = bound(timestamp, cl.termEndTime() + 10 days + 1, cl.termEndTime() + 10000 days);
    vm.warp(timestamp);

    assertTrue(cl.isLate());
  }
}

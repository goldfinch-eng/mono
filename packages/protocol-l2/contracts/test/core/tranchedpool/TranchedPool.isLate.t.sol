// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";

contract TranchedPoolIsLateTest is TranchedPoolBaseTest {
  function setUp() public override {
    super.setUp();

    _startImpersonation(GF_OWNER);
    gfConfig.setNumber(uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays), 10);
    _stopImpersonation();
  }

  function testNotLateIfNoBalance() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    assertFalse(cl.isLate());

    uint256 limit = usdcVal(100);

    deposit(pool, 2, limit, GF_OWNER);
    lockJuniorTranche(pool);

    seniorDepositAndInvest(pool, limit * 4);
    lockSeniorTranche(pool);

    drawdown(pool, limit);

    pay(pool, cl.interestOwed() + cl.principalOwed() + cl.balance());

    vm.warp(cl.termEndTime());

    assertFalse(cl.isLate());
  }

  function testNotLateIfNotPastDueTime(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    uint256 limit = usdcVal(100);
    deposit(pool, 2, limit, GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, limit * 4);
    lockSeniorTranche(pool);
    drawdown(pool, limit);

    timestamp = bound(timestamp, block.timestamp, cl.nextDueTime() - 1);

    vm.warp(timestamp);

    assertFalse(cl.isLate());
  }

  function testLateIfPastDueTimeAndPastGracePeriod(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    uint256 limit = usdcVal(100);
    deposit(pool, 2, limit, GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, limit * 4);
    lockSeniorTranche(pool);
    drawdown(pool, limit);

    timestamp = bound(timestamp, cl.nextDueTime() + (10 days) + 1, cl.termEndTime());

    vm.warp(timestamp);

    assertTrue(cl.isLate());
  }

  function testIsLateIfCurrentAtTermEndTimeAndAfterGracePeriod(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    uint256 limit = usdcVal(100);
    deposit(pool, 2, limit, GF_OWNER);
    lockJuniorTranche(pool);
    seniorDepositAndInvest(pool, limit * 4);
    lockSeniorTranche(pool);
    drawdown(pool, limit);

    // Advance to the last payment period and pay back interest
    for (uint i = 0; i < 11; ++i) {
      vm.warp(cl.nextDueTime());
      pay(pool, cl.interestOwed());
    }

    assertEq(cl.nextDueTime(), cl.termEndTime());

    timestamp = bound(timestamp, cl.termEndTime() + 10 days + 1, cl.termEndTime() + 10000 days);
    vm.warp(timestamp);

    assertTrue(cl.isLate());
  }
}

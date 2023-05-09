// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolNextDueTimeTest is TranchedPoolBaseTest {
  function testNextDueTimeIsZeroBeforeDrawdown() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    assertZero(cl.nextDueTime());
    deposit(pool, 2, usdcVal(1), GF_OWNER);
    lockJuniorTranche(pool);
    assertZero(cl.nextDueTime());
    seniorDepositAndInvest(pool, usdcVal(4));
    lockSeniorTranche(pool);
    assertZero(cl.nextDueTime());
  }

  function testNextDueTimeSetByDrawdown() public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1), GF_OWNER);

    (ISchedule s, uint64 startTime) = cl.schedule();

    assertEq(cl.nextDueTime(), s.nextDueTimeAt(startTime, block.timestamp));
  }

  function testNextDueTimeShouldNotUpdateAsTheResultOfAPayment(
    uint256 paymentTime,
    uint256 paymentAmount
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    paymentTime = bound(
      paymentTime,
      cl.nextDueTime(),
      cl.nextDueTime() + periodInSeconds(pool) - 1
    );
    vm.warp(paymentTime);
    paymentAmount = bound(
      paymentAmount,
      1,
      cl.interestOwed() + cl.interestAccrued() + cl.balance()
    );
    uint256 nextDueTimeBefore = cl.nextDueTime();
    pay(pool, cl.interestOwed() + cl.interestAccrued());
    assertEq(nextDueTimeBefore, cl.nextDueTime());
  }

  function testNextDueTimeIsCappedAtTermEndTime(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.termEndTime(), cl.termEndTime() * 1000);
    vm.warp(timestamp);
    assertGt(cl.nextDueTime(), 0);
    assertEq(cl.nextDueTime(), cl.termEndTime());
  }

  function testNextDueTimeChangesWhenCrossingPeriods(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.nextDueTime() + 1, cl.termEndTime());
    uint256 oldNextDueTime = cl.nextDueTime();

    (ISchedule s, uint64 startTime) = cl.schedule();
    uint256 newNextDueTime = s.nextDueTimeAt(startTime, timestamp);

    vm.warp(timestamp);

    assertGt(cl.nextDueTime(), oldNextDueTime);
    assertEq(cl.nextDueTime(), newNextDueTime);
  }

  function testNextDueTimeUpdatesWhenBalanceIsZero(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    pay(pool, cl.balance() + cl.interestOwed() + cl.interestAccrued());
    assertZero(cl.balance(), "balance not zero");

    timestamp = bound(timestamp, cl.nextDueTime() + 1, cl.termEndTime());

    vm.warp(timestamp);

    (ISchedule s, uint64 startTime) = cl.schedule();
    assertEq(cl.nextDueTime(), s.nextDueTimeAt(startTime, block.timestamp));
  }

  function testNextDueTimeUnchangedWhenIDrawdownOnZeroBalanceInSamePeriod(
    uint256 timestamp
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    uint256 oldNextDueTime = cl.nextDueTime();
    pay(pool, cl.balance() + cl.interestAccrued() + cl.interestOwed());
    timestamp = bound(timestamp, block.timestamp + 1, cl.nextDueTime() - 1);
    vm.warp(timestamp);
    drawdown(pool, usdcVal(1000));
    assertEq(oldNextDueTime, cl.nextDueTime());
  }
}

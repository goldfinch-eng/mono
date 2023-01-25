// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanNextDueTimeTest is CallableLoanBaseTest {
  function testNextDueTimeIsZeroBeforeDrawdown() public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    assertZero(cl.nextDueTime());
    depositAndDrawdown(callableLoan, usdcVal(4));
    assertZero(cl.nextDueTime());
  }

  function testNextDueTimeSetByDrawdown() public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1), GF_OWNER);

    (ISchedule s, uint64 startTime) = cl.schedule();

    assertEq(cl.nextDueTime(), s.nextDueTimeAt(startTime, block.timestamp));
  }

  function testNextDueTimeShouldNotUpdateAsTheResultOfAPayment(
    uint256 paymentTime,
    uint256 paymentAmount
  ) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    paymentTime = bound(
      paymentTime,
      cl.nextDueTime(),
      cl.nextDueTime() + periodInSeconds(callableLoan) - 1
    );
    vm.warp(paymentTime);
    paymentAmount = bound(
      paymentAmount,
      1,
      cl.interestOwed() + cl.interestAccrued() + cl.balance()
    );
    uint256 nextDueTimeBefore = cl.nextDueTime();
    pay(callableLoan, cl.interestOwed() + cl.interestAccrued());
    assertEq(nextDueTimeBefore, cl.nextDueTime());
  }

  function testNextDueTimeIsCappedAtTermEndTime(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.termEndTime(), cl.termEndTime() * 1000);
    vm.warp(timestamp);
    assertGt(cl.nextDueTime(), 0);
    assertEq(cl.nextDueTime(), cl.termEndTime());
  }

  function testNextDueTimeChangesWhenCrossingPeriods(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.nextDueTime() + 1, cl.termEndTime());
    uint256 oldNextDueTime = cl.nextDueTime();

    (ISchedule s, uint64 startTime) = cl.schedule();
    uint256 newNextDueTime = s.nextDueTimeAt(startTime, timestamp);

    vm.warp(timestamp);

    assertGt(cl.nextDueTime(), oldNextDueTime);
    assertEq(cl.nextDueTime(), newNextDueTime);
  }

  function testNextDueTimeUpdatesWhenBalanceIsZero(uint256 timestamp) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    pay(callableLoan, cl.balance() + cl.interestOwed() + cl.interestAccrued());
    assertZero(cl.balance(), "balance not zero");

    timestamp = bound(timestamp, cl.nextDueTime() + 1, cl.termEndTime());

    vm.warp(timestamp);

    (ISchedule s, uint64 startTime) = cl.schedule();
    assertEq(cl.nextDueTime(), s.nextDueTimeAt(startTime, block.timestamp));
  }

  function testNextDueTimeUnchangedWhenIDrawdownOnZeroBalanceInSamePeriod(
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, CreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    uint256 oldNextDueTime = cl.nextDueTime();
    pay(callableLoan, cl.balance() + cl.interestAccrued() + cl.interestOwed());
    timestamp = bound(timestamp, block.timestamp + 1, cl.nextDueTime() - 1);
    vm.warp(timestamp);
    drawdown(callableLoan, usdcVal(1000));
    assertEq(oldNextDueTime, cl.nextDueTime());
  }
}

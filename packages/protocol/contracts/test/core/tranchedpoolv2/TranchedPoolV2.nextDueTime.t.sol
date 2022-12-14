// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

import {TranchedPoolV2} from "../../../protocol/core/TranchedPoolV2.sol";
import {CreditLineV2} from "../../../protocol/core/CreditLineV2.sol";

import {TranchedPoolV2BaseTest} from "./BaseTranchedPoolV2.t.sol";

contract TranchedPoolV2NextDueTimeTest is TranchedPoolV2BaseTest {
  function testNextDueTimeIsZeroBeforeDrawdown() public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    assertZero(cl.nextDueTime());
    deposit(pool, 2, usdcVal(1), GF_OWNER);
    lockJuniorTranche(pool);
    assertZero(cl.nextDueTime());
    seniorDepositAndInvest(pool, usdcVal(4));
    lockSeniorTranche(pool);
    assertZero(cl.nextDueTime());
  }

  function testNextDueTimeSetByDrawdown() public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1), GF_OWNER);
    assertEq(cl.nextDueTime(), block.timestamp + periodInSeconds(pool));
  }

  function testNextDueTimeShouldNotUpdateAsTheResultOfAPayment(
    uint256 paymentTime,
    uint256 paymentAmount
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
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
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.termEndTime(), cl.termEndTime() * 1000);
    vm.warp(timestamp);
    assertGt(cl.nextDueTime(), 0);
    assertEq(cl.nextDueTime(), cl.termEndTime());
  }

  function testNextDueTimeChangesWhenCrossingPeriods(uint256 timestamp) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.nextDueTime() + 1, cl.termEndTime());
    uint256 oldNextDueTime = cl.nextDueTime();
    uint256 timestampBefore = block.timestamp;
    vm.warp(timestamp);
    uint256 periodsElapsed = (block.timestamp - timestampBefore) / periodInSeconds(pool);
    uint256 expectedNextDueTime = Math.min(
      oldNextDueTime + periodsElapsed * periodInSeconds(pool),
      cl.termEndTime()
    );
    assertGt(cl.nextDueTime(), oldNextDueTime);
    assertEq(cl.nextDueTime(), expectedNextDueTime);
  }

  function testNextDueTimeUpdatesWhenBalanceIsZero(uint256 timestamp) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    pay(pool, cl.balance() + cl.interestOwed() + cl.interestAccrued());
    assertZero(cl.balance(), "balance not zero");

    uint256 oldNextDueTime = cl.nextDueTime();
    timestamp = bound(timestamp, cl.nextDueTime() + 1, cl.termEndTime());
    uint256 timestampBefore = block.timestamp;

    vm.warp(timestamp);

    uint256 periodsElapsed = (block.timestamp - timestampBefore) / periodInSeconds(pool);
    uint256 expectedNextDueTime = Math.min(
      oldNextDueTime + periodsElapsed * periodInSeconds(pool),
      cl.termEndTime()
    );

    assertEq(cl.nextDueTime(), expectedNextDueTime, "next due time wrong");
  }

  function testNextDueTimeUnchangedWhenIDrawdownOnZeroBalanceInSamePeriod(
    uint256 timestamp
  ) public {
    (TranchedPoolV2 pool, CreditLineV2 cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    uint256 oldNextDueTime = cl.nextDueTime();
    pay(pool, cl.balance() + cl.interestAccrued() + cl.interestOwed());
    timestamp = bound(timestamp, block.timestamp + 1, cl.nextDueTime() - 1);
    vm.warp(timestamp);
    drawdown(pool, usdcVal(1000));
    assertEq(oldNextDueTime, cl.nextDueTime());
  }
}

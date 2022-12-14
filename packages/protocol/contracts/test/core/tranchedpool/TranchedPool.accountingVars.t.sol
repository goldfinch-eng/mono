// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {TranchedPool} from "../../../protocol/core/TranchedPool.sol";
import {CreditLine} from "../../../protocol/core/CreditLine.sol";

import {TranchedPoolBaseTest} from "./BaseTranchedPool.t.sol";

contract TranchedPoolAccountingVarsTest is TranchedPoolBaseTest {
  function testGetAccountingVariablesRevertsForInvalidTimestamp(uint256 timestamp) public {
    (, CreditLine cl) = defaultTranchedPool();
    timestamp = bound(timestamp, 0, cl.interestAccruedAsOf() - 1);

    vm.expectRevert(bytes("IT"));
    cl.interestOwedAt(timestamp);

    vm.expectRevert(bytes("IT"));
    cl.interestAccruedAt(timestamp);

    vm.expectRevert(bytes("IT"));
    cl.principalOwedAt(timestamp);

    vm.expectRevert(bytes("IT"));
    cl.totalInterestOwedAt(timestamp);

    vm.expectRevert(bytes("IT"));
    cl.totalInterestAccruedAt(timestamp);
  }

  function testAccountingVarsWithinSamePeriod(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, block.timestamp + 1, cl.nextDueTime() - 1);

    // Interest and principal owed doesn't change within a period
    uint256 expectedInterestOwed = cl.interestOwed();
    uint256 expectedPrincipalOwed = cl.principalOwed();
    // Interest accrued DOES change within a period
    uint256 expectedInterestAccrued = getInterestAccrued(
      block.timestamp,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );

    assertEq(cl.interestOwedAt(timestamp), expectedInterestOwed);
    assertEq(cl.interestAccruedAt(timestamp), expectedInterestAccrued);
    assertEq(cl.principalOwedAt(timestamp), expectedPrincipalOwed);
    assertEq(cl.totalInterestAccruedAt(timestamp), expectedInterestAccrued);
    assertEq(cl.totalInterestOwedAt(timestamp), expectedInterestOwed);
    vm.warp(timestamp);
    assertEq(cl.interestOwed(), expectedInterestOwed);
    assertEq(cl.interestAccrued(), expectedInterestAccrued);
    assertEq(cl.principalOwed(), expectedPrincipalOwed);
    assertEq(cl.totalInterestAccrued(), expectedInterestAccrued);
    assertEq(cl.totalInterestOwed(), expectedInterestOwed);
  }

  function testAccountingVarsCrossingOneOrMorePaymentPeriods(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.nextDueTime(), cl.termEndTime() - 1);

    // Principal owed shouldn't change before termEndTime
    uint256 expectedPrincipalOwed = cl.principalOwed();
    // Interest owed should be up to the most recently past next due time
    uint256 periodsElapsed = (timestamp - block.timestamp) / periodInSeconds(pool);
    uint256 nextDueTime = block.timestamp + periodsElapsed * periodInSeconds(pool);
    uint256 expectedInterestOwed = getInterestAccrued(
      block.timestamp,
      nextDueTime,
      cl.balance(),
      cl.interestApr()
    );
    // Interest accrued should be from due time to the current time
    uint256 expectedInterestAccrued = getInterestAccrued(
      nextDueTime,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      block.timestamp,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );

    assertEq(cl.interestOwedAt(timestamp), expectedInterestOwed);
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HALF_CENT);
    assertEq(cl.principalOwedAt(timestamp), expectedPrincipalOwed);
    assertEq(cl.totalInterestAccruedAt(timestamp), expectedTotalInterestAccrued);
    assertEq(cl.totalInterestOwedAt(timestamp), expectedInterestOwed);
    vm.warp(timestamp);
    assertEq(cl.interestOwed(), expectedInterestOwed);
    assertApproxEqAbs(cl.interestAccrued(), expectedInterestAccrued, HALF_CENT);
    assertEq(cl.principalOwed(), expectedPrincipalOwed);
    assertEq(cl.totalInterestAccrued(), expectedTotalInterestAccrued);
    assertEq(cl.totalInterestOwed(), expectedInterestOwed);
  }

  function testAccountingVarsForLatePaymentWithinGracePeriod(uint256 timestamp) public {
    // Pool with 10% late fee
    (TranchedPool pool, CreditLine cl) = tranchedPoolWithLateFees(10 * 1e16, 5);
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    uint256 drawdownTime = block.timestamp;
    timestamp = bound(timestamp, cl.nextDueTime(), cl.nextDueTime() + 5 days);

    // total interest accrued should not include late fees, just normal apr
    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      drawdownTime,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    // interest accrued should not include late fees, just normal apr
    uint256 expectedInterestAccrued = getInterestAccrued(
      cl.nextDueTime(),
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    // all interest from the previous period should be owed
    uint256 expectedInterestOwed = getInterestAccrued(
      drawdownTime,
      cl.nextDueTime(),
      cl.balance(),
      cl.interestApr()
    );

    assertEq(cl.totalInterestAccruedAt(timestamp), expectedTotalInterestAccrued);
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HALF_CENT);
    assertEq(cl.interestOwedAt(timestamp), expectedInterestOwed);
    assertZero(cl.principalOwedAt(timestamp));

    vm.warp(timestamp);

    assertEq(cl.totalInterestAccrued(), expectedTotalInterestAccrued);
    assertApproxEqAbs(cl.interestAccrued(), expectedInterestAccrued, HALF_CENT);
    assertEq(cl.interestOwed(), expectedInterestOwed);
    // No principal should be owed
    assertZero(cl.principalOwed());
  }

  function testAccountingVarsForLatePaymentAfterGracePeriodBeforeNextPaymentPeriod(
    uint256 timestamp
  ) public {
    // Pool with 10% late fee
    (TranchedPool pool, CreditLine cl) = tranchedPoolWithLateFees(10 * 1e16, 5);
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    uint256 drawdownTime = block.timestamp;
    timestamp = bound(
      timestamp,
      cl.nextDueTime() + 5 days,
      cl.nextDueTime() + periodInSeconds(pool) - 1
    );

    // total interest accrued should include late fees
    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      drawdownTime,
      timestamp,
      cl.balance(),
      cl.interestApr()
    ) + getInterestAccrued(cl.nextDueTime() + 5 days, timestamp, cl.balance(), 10 * 1e16);
    // interest accrued should include late fees
    uint256 expectedInterestAccrued = getInterestAccrued(
      cl.nextDueTime(),
      timestamp,
      cl.balance(),
      cl.interestApr()
    ) + getInterestAccrued(cl.nextDueTime() + 5 days, timestamp, cl.balance(), 10 * 1e16);
    // all interest from the previous period should be owed
    uint256 expectedInterestOwed = getInterestAccrued(
      drawdownTime,
      cl.nextDueTime(),
      cl.balance(),
      cl.interestApr()
    );

    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      expectedTotalInterestAccrued,
      HALF_CENT
    );
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HALF_CENT);
    assertEq(cl.interestOwedAt(timestamp), expectedInterestOwed);

    vm.warp(timestamp);
    assertApproxEqAbs(cl.totalInterestAccrued(), expectedTotalInterestAccrued, HALF_CENT);
    assertApproxEqAbs(cl.interestAccrued(), expectedInterestAccrued, HALF_CENT);
    assertEq(cl.interestOwed(), expectedInterestOwed);
  }

  function testAccountingVarsForLatePaymentAfterGracePeriodAfterNextPaymentPeriod(
    uint256 timestamp
  ) public {
    (TranchedPool pool, CreditLine cl) = tranchedPoolWithLateFees(10 * 1e16, 5);
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    uint256 drawdownTime = block.timestamp;
    timestamp = bound(timestamp, cl.nextDueTime() + periodInSeconds(pool), cl.termEndTime() - 1);

    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      drawdownTime,
      timestamp,
      cl.balance(),
      cl.interestApr()
    ) + getInterestAccrued(cl.nextDueTime() + 5 days, timestamp, cl.balance(), 10 * 1e16);

    // All accrued interest has late fee
    uint256 periodsElapsed = (timestamp - drawdownTime) / periodInSeconds(pool);
    uint256 newNextDueTime = drawdownTime + periodsElapsed * periodInSeconds(pool);
    uint256 expectedInterestAccrued = getInterestAccrued(
      newNextDueTime,
      timestamp,
      cl.balance(),
      cl.interestApr() + 10 * 1e16
    );

    uint256 expectedInterestOwed = getInterestAccrued(
      drawdownTime,
      newNextDueTime,
      cl.balance(),
      cl.interestApr()
    ) + getInterestAccrued(cl.nextDueTime() + 5 days, newNextDueTime, cl.balance(), 10 * 1e16);

    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      expectedTotalInterestAccrued,
      HALF_CENT
    );
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HALF_CENT);
    assertApproxEqAbs(cl.interestOwedAt(timestamp), expectedInterestOwed, HALF_CENT);

    vm.warp(timestamp);

    assertApproxEqAbs(cl.totalInterestAccrued(), expectedTotalInterestAccrued, HALF_CENT);
    assertApproxEqAbs(cl.interestAccrued(), expectedInterestAccrued, HALF_CENT);
    assertApproxEqAbs(cl.interestOwed(), expectedInterestOwed, HALF_CENT);
  }

  function testAccountingVarsCrossingTermEndTime(uint256 timestamp) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.termEndTime(), cl.termEndTime() + 1000 days);

    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      block.timestamp,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 expectedInterestOwed = expectedTotalInterestAccrued;

    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      expectedTotalInterestAccrued,
      HALF_CENT
    );
    assertApproxEqAbs(cl.interestOwedAt(timestamp), expectedInterestOwed, HALF_CENT);
    assertZero(cl.interestAccruedAt(timestamp));

    vm.warp(timestamp);

    assertApproxEqAbs(cl.totalInterestAccrued(), expectedTotalInterestAccrued, HALF_CENT);
    assertApproxEqAbs(cl.interestOwed(), expectedInterestOwed, HALF_CENT);
    assertZero(cl.interestAccrued());
  }

  function testAccountingVarsDoNotAccumulateWhenBalanceIsZero(
    uint256 firstJump,
    uint256 secondJump
  ) public {
    (TranchedPool pool, CreditLine cl) = defaultTranchedPool();
    fundAndDrawdown(pool, usdcVal(1000), GF_OWNER);

    // Advance to random time during the loan and pay back everything
    firstJump = bound(firstJump, block.timestamp, cl.termEndTime());
    vm.warp(firstJump);
    pay(pool, cl.interestOwed() + cl.interestAccrued() + cl.balance());
    assertZero(cl.balance());
    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());

    // Advance to a random time and assert amounts owed have not changed
    secondJump = bound(secondJump, firstJump, firstJump + 1000 days);
    vm.warp(secondJump);
    assertZero(cl.balance());
    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());
  }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {CallableLoanConfigHelper} from "../../../protocol/core/callable/CallableLoanConfigHelper.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";
import {IERC20WithName} from "../../../interfaces/IERC20WithName.sol";
// solhint-disable-next-line max-line-length
import {IERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";
import {PaymentScheduleLogic, PaymentSchedule} from "../../../protocol/core/schedule/PaymentSchedule.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";

contract CallableLoanAccountingVarsTest is CallableLoanBaseTest {
  using CallableLoanConfigHelper for IGoldfinchConfig;
  using PaymentScheduleLogic for PaymentSchedule;

  function testGetInterestVariablesRevertsForInvalidTimestamp(uint256 timestamp) public {
    (, ICreditLine cl) = defaultCallableLoan();
    timestamp = bound(timestamp, 0, cl.interestAccruedAsOf() - 1);

    vm.expectRevert(bytes("IT"));
    cl.interestOwedAt(timestamp);

    vm.expectRevert(bytes("IT"));
    cl.interestAccruedAt(timestamp);

    vm.expectRevert(bytes("IT"));
    cl.totalInterestOwedAt(timestamp);

    vm.expectRevert(bytes("IT"));
    cl.totalInterestAccruedAt(timestamp);
  }

  function testAccountingVarsWithinSamePeriod(uint256 timestamp) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
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
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();

    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.nextDueTime(), cl.termEndTime() - 1);

    // Principal owed shouldn't change before termEndTime
    uint256 expectedPrincipalOwed = cl.principalOwed();
    // Interest owed should be up to the most recently past next due time
    ISchedule schedule = callableLoan.schedule();
    uint64 startTime = uint64(callableLoan.termStartTime());
    uint256 previousDueTime = schedule.previousInterestDueTimeAt(startTime, timestamp);
    uint256 expectedInterestOwed = getInterestAccrued(
      block.timestamp,
      previousDueTime,
      cl.balance(),
      cl.interestApr()
    );
    // Interest accrued should be from due time to the current time
    uint256 expectedInterestAccrued = getInterestAccrued(
      previousDueTime,
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

    // TODO: Investigate why CallableLoans require half cent margin of error for marked assertions.
    //       TranchedPool only requires margin of error for interestAccruedAt
    // TODO: Why margin of error?
    assertApproxEqAbs(cl.interestOwedAt(timestamp), expectedInterestOwed, HUNDREDTH_CENT);
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.principalOwedAt(timestamp), expectedPrincipalOwed);
    // TODO: Why margin of error?
    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      expectedTotalInterestAccrued,
      HUNDREDTH_CENT
    );

    // TODO: Why margin of error?
    assertApproxEqAbs(cl.totalInterestOwedAt(timestamp), expectedInterestOwed, HUNDREDTH_CENT);

    vm.warp(timestamp);

    // TODO: Why margin of error?
    assertApproxEqAbs(cl.interestOwed(), expectedInterestOwed, HUNDREDTH_CENT);
    assertApproxEqAbs(cl.interestAccrued(), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.principalOwed(), expectedPrincipalOwed);
    // TODO: Why margin of error?
    assertApproxEqAbs(cl.totalInterestAccrued(), expectedTotalInterestAccrued, HUNDREDTH_CENT);
    // TODO: Why margin of error?
    assertApproxEqAbs(cl.totalInterestOwed(), expectedInterestOwed, HUNDREDTH_CENT);
  }

  function testAccountingVarsForLatePaymentWithinGracePeriod(uint256 timestamp) public {
    // Callable Loan with 10% late fee
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLateFees(10 * 1e16, 5);
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
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
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.interestOwedAt(timestamp), expectedInterestOwed);
    assertZero(cl.principalOwedAt(timestamp));

    vm.warp(timestamp);

    assertEq(cl.totalInterestAccrued(), expectedTotalInterestAccrued);
    assertApproxEqAbs(cl.interestAccrued(), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.interestOwed(), expectedInterestOwed);
    // No principal should be owed
    assertZero(cl.principalOwed());
  }

  function testAccountingVarsForLatePaymentAfterGracePeriodBeforeNextPaymentPeriod(
    uint256 timestamp
  ) public {
    // Loan with 10% late fee
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLateFees(10 * 1e16, 5);
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    uint256 drawdownTime = block.timestamp;
    uint256 nextDueTime = cl.nextDueTime();
    timestamp = bound(
      timestamp,
      nextDueTime + 5 days,
      nextDueTime + callableLoan.nextDueTimeAt(nextDueTime + 1) - 1
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
      HUNDREDTH_CENT
    );
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.interestOwedAt(timestamp), expectedInterestOwed);

    vm.warp(timestamp);
    assertApproxEqAbs(cl.totalInterestAccrued(), expectedTotalInterestAccrued, HUNDREDTH_CENT);
    assertApproxEqAbs(cl.interestAccrued(), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.interestOwed(), expectedInterestOwed);
  }

  function testTotalIntAccruedForLatePaymentAfterGracePeriodAfterNextPaymentPeriod(
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLateFees(10 * 1e16, 5);
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);

    // Skip to the payment period after the next one
    timestamp = bound(
      timestamp,
      callableLoan.nextDueTimeAt(cl.nextDueTime()),
      cl.termEndTime() - 1
    );

    ISchedule s = callableLoan.schedule();
    uint64 startTime = uint64(callableLoan.termStartTime());

    uint256 totalRegIntAccrued = getInterestAccrued(
      startTime,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 lateFeesStartAt = s.nextDueTimeAt(startTime, cl.lastFullPaymentTime()) +
      gfConfig.getLatenessGracePeriodInDays() *
      (1 days);
    uint256 totalLateIntAccrued = getInterestAccrued(
      lateFeesStartAt,
      timestamp,
      cl.balance(),
      cl.lateFeeApr()
    );

    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      totalRegIntAccrued + totalLateIntAccrued,
      HUNDREDTH_CENT
    );
    vm.warp(timestamp);
    assertApproxEqAbs(
      cl.totalInterestAccrued(),
      totalRegIntAccrued + totalLateIntAccrued,
      HUNDREDTH_CENT
    );
  }

  function testInterestAccruedForLatePaymentAfterGracePeriodAfterNextPaymentPeriod(
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLateFees(10 * 1e16, 5);
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);

    // Skip to the payment period after the next one
    timestamp = bound(
      timestamp,
      callableLoan.nextDueTimeAt(cl.nextDueTime()),
      cl.termEndTime() - 1
    );

    ISchedule s = callableLoan.schedule();
    uint64 startTime = uint64(callableLoan.termStartTime());

    // Calculate regular interest that has accrued in the current period (from last due time
    // until timestamp)
    uint256 regIntAccrued = getInterestAccrued(
      s.previousInterestDueTimeAt(startTime, timestamp),
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    // Calculate late fee interest in the current period
    uint256 lateFeesStartAt = s.nextDueTimeAt(startTime, cl.lastFullPaymentTime());
    if (lateFeesStartAt < s.previousInterestDueTimeAt(startTime, timestamp)) {
      lateFeesStartAt = s.previousInterestDueTimeAt(startTime, timestamp);
    }
    uint256 lateIntAccrued;
    if (lateFeesStartAt < timestamp) {
      lateIntAccrued = getInterestAccrued(
        lateFeesStartAt,
        timestamp,
        cl.balance(),
        cl.lateFeeApr()
      );
    }

    assertApproxEqAbs(
      cl.interestAccruedAt(timestamp),
      regIntAccrued + lateIntAccrued,
      HUNDREDTH_CENT
    );
    vm.warp(timestamp);
    assertApproxEqAbs(cl.interestAccrued(), regIntAccrued + lateIntAccrued, HUNDREDTH_CENT);
  }

  function testInterestOwedForLatePaymentAfterGracePeriodAfterNextPaymentPeriod(
    uint256 timestamp
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = callableLoanWithLateFees(10 * 1e16, 5);
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);

    // Skip to the payment period after the next one
    timestamp = bound(
      timestamp,
      callableLoan.nextDueTimeAt(cl.nextDueTime()),
      cl.termEndTime() - 1
    );

    ISchedule s = callableLoan.schedule();
    uint64 startTime = uint64(callableLoan.termStartTime());

    uint256 regIntOwed = getInterestAccrued(
      startTime,
      s.previousInterestDueTimeAt(startTime, timestamp),
      cl.balance(),
      cl.interestApr()
    );

    uint256 lateFeesStartAt = s.nextDueTimeAt(startTime, cl.lastFullPaymentTime()) +
      gfConfig.getLatenessGracePeriodInDays() *
      (1 days);
    uint256 lateIntOwed;
    if (lateFeesStartAt < s.previousInterestDueTimeAt(startTime, timestamp)) {
      lateIntOwed = getInterestAccrued(
        lateFeesStartAt,
        s.previousInterestDueTimeAt(startTime, timestamp),
        cl.balance(),
        cl.lateFeeApr()
      );
    }

    assertApproxEqAbs(cl.interestOwedAt(timestamp), regIntOwed + lateIntOwed, HUNDREDTH_CENT);
    vm.warp(timestamp);
    assertApproxEqAbs(cl.interestOwed(), regIntOwed + lateIntOwed, HUNDREDTH_CENT);
  }

  function testAccountingVarsCrossingTermEndTime(uint256 timestamp) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
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
      HUNDREDTH_CENT
    );
    assertApproxEqAbs(cl.interestOwedAt(timestamp), expectedInterestOwed, HUNDREDTH_CENT);
    assertZero(cl.interestAccruedAt(timestamp));

    vm.warp(timestamp);

    assertApproxEqAbs(cl.totalInterestAccrued(), expectedTotalInterestAccrued, HUNDREDTH_CENT);
    assertApproxEqAbs(cl.interestOwed(), expectedInterestOwed, HUNDREDTH_CENT);
    assertZero(cl.interestAccrued());
  }

  function testAccountingVarsDoNotAccumulateWhenBalanceIsZero(
    uint256 firstJump,
    uint256 secondJump
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);

    // Advance to random time during the loan and pay back everything
    firstJump = bound(firstJump, block.timestamp, cl.termEndTime());
    vm.warp(firstJump);

    uint nextDueTime = cl.nextDueTime();
    pay(callableLoan, cl.interestAccrued() + cl.interestOwed() + cl.balance());
    assertZero(cl.balance());
    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());

    // Advance to next principal payment period in order for principal payment to process.
    vm.warp(nextDueTime);
    // Pay off any remaining interest which has accrued since last payment.

    pay(callableLoan, cl.interestAccrued() + cl.interestOwed());
    // // Advance to a random time and assert amounts owed have not changed
    // secondJump = bound(secondJump, firstJump, firstJump + 1000 days);
    // vm.warp(secondJump);
    // assertZero(cl.balance());
    // assertZero(cl.interestOwed());
    // assertZero(cl.interestAccrued());
  }
}

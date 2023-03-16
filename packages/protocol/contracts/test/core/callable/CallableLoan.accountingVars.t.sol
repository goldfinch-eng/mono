// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {ISchedule} from "../../../interfaces/ISchedule.sol";
import {ICreditLine} from "../../../interfaces/ICreditLine.sol";
import {CallableLoan} from "../../../protocol/core/callable/CallableLoan.sol";
import {ICallableLoanErrors} from "../../../interfaces/ICallableLoanErrors.sol";
import {CallableLoanConfigHelper} from "../../../protocol/core/callable/CallableLoanConfigHelper.sol";
import {ConfigOptions} from "../../../protocol/core/ConfigOptions.sol";
import {IGoldfinchConfig} from "../../../interfaces/IGoldfinchConfig.sol";
import {IERC20WithName} from "../../../interfaces/IERC20WithName.sol";
// solhint-disable-next-line max-line-length
import {IERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";
import {PaymentScheduleLogic, PaymentSchedule} from "../../../protocol/core/schedule/PaymentSchedule.sol";

import {CallableLoanBaseTest} from "./BaseCallableLoan.t.sol";
import {MathUpgradeable as Math} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract CallableLoanAccountingVarsTest is CallableLoanBaseTest {
  using CallableLoanConfigHelper for IGoldfinchConfig;
  using PaymentScheduleLogic for PaymentSchedule;

  uint256 lateGracePeriodInDays;

  function setUp() public override {
    super.setUp();
    lateGracePeriodInDays = gfConfig.getNumber(
      uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays)
    );
  }

  function testGetInterestVariablesRevertsForInvalidTimestamp(uint256 timestamp) public {
    (, ICreditLine cl) = defaultCallableLoan();
    timestamp = bound(timestamp, 0, cl.interestAccruedAsOf() - 1);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.InputTimestampBeforeCheckpoint.selector,
        timestamp,
        cl.interestAccruedAsOf()
      )
    );
    cl.interestOwedAt(timestamp);

    vm.expectRevert(
      abi.encodeWithSelector(ICallableLoanErrors.InputTimestampInThePast.selector, timestamp)
    );
    cl.interestAccruedAt(timestamp);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.InputTimestampBeforeCheckpoint.selector,
        timestamp,
        cl.interestAccruedAsOf()
      )
    );
    cl.totalInterestOwedAt(timestamp);

    vm.expectRevert(
      abi.encodeWithSelector(
        ICallableLoanErrors.InputTimestampBeforeCheckpoint.selector,
        timestamp,
        cl.interestAccruedAsOf()
      )
    );
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
    uint256 lateGracePeriodInDays = gfConfig.getNumber(
      uint256(ConfigOptions.Numbers.LatenessGracePeriodInDays)
    );

    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);
    timestamp = bound(timestamp, cl.nextDueTime(), cl.termEndTime() - 1);

    // Principal owed shouldn't change before termEndTime
    uint256 expectedPrincipalOwed = cl.principalOwed();
    // Interest owed should be up to the most recently past next due time
    ISchedule schedule = callableLoan.schedule();
    uint256 previousDueTimeAtTimestamp = schedule.previousInterestDueTimeAt(
      block.timestamp,
      timestamp
    );
    uint256 expectedInterestOwed = getInterestAccrued(
      block.timestamp,
      previousDueTimeAtTimestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 expectedInterestOwedLateFees = getInterestAccrued(
      cl.nextDueTime() + lateGracePeriodInDays,
      previousDueTimeAtTimestamp,
      cl.balance(),
      cl.lateFeeApr()
    );

    // Interest accrued should be from due time to the current time
    uint256 expectedInterestAccrued = getInterestAccrued(
      previousDueTimeAtTimestamp,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 expectedInterestAccruedLateFees = getInterestAccrued(
      Math.max(previousDueTimeAtTimestamp, cl.nextDueTime() + lateGracePeriodInDays),
      timestamp,
      cl.balance(),
      cl.lateFeeApr()
    );

    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      block.timestamp,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );

    uint256 expectedTotalInterestAccruedLateFees = getInterestAccrued(
      cl.nextDueTime() + lateGracePeriodInDays,
      timestamp,
      cl.balance(),
      cl.lateFeeApr()
    );

    assertApproxEqAbs(cl.interestOwedAt(timestamp), expectedInterestOwed, HUNDREDTH_CENT);
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.principalOwedAt(timestamp), expectedPrincipalOwed);
    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      expectedTotalInterestAccrued,
      HUNDREDTH_CENT
    );

    assertApproxEqAbs(cl.totalInterestOwedAt(timestamp), expectedInterestOwed, HUNDREDTH_CENT);

    vm.warp(timestamp);

    assertApproxEqAbs(
      cl.interestOwed(),
      expectedInterestOwed + expectedInterestOwedLateFees,
      HUNDREDTH_CENT,
      "After warp should include late fees interestOwed"
    );
    assertApproxEqAbs(
      cl.interestAccrued(),
      expectedInterestAccrued + expectedInterestAccruedLateFees,
      HUNDREDTH_CENT,
      "After warp should include late fees interestAccrued"
    );
    assertEq(cl.principalOwed(), expectedPrincipalOwed);

    assertApproxEqAbs(
      cl.totalInterestOwed(),
      expectedInterestOwed + expectedInterestOwedLateFees,
      HUNDREDTH_CENT,
      "After warp should include late fees totalInterestOwed"
    );
    assertApproxEqAbs(
      cl.totalInterestAccrued(),
      expectedTotalInterestAccrued + expectedTotalInterestAccruedLateFees,
      HUNDREDTH_CENT,
      "After warp should include late fees totalInterestAccrued"
    );
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
      callableLoan.nextDueTimeAt(nextDueTime + 1) - 1
    );

    // total interest accrued should not include late fees
    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      drawdownTime,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    // interest accrued should include not late fees
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

    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      expectedTotalInterestAccrued,
      HUNDREDTH_CENT
    );
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), expectedInterestAccrued, HUNDREDTH_CENT);
    assertEq(cl.interestOwedAt(timestamp), expectedInterestOwed);

    vm.warp(timestamp);

    uint256 totalInterestAccruedLateFees = getInterestAccrued(
      nextDueTime + 5 days,
      timestamp,
      cl.balance(),
      10 * 1e16
    );

    uint256 interestAccruedLateFees = getInterestAccrued(
      nextDueTime + 5 days,
      timestamp,
      cl.balance(),
      10 * 1e16
    );

    assertApproxEqAbs(
      cl.totalInterestAccrued(),
      expectedTotalInterestAccrued + totalInterestAccruedLateFees,
      HUNDREDTH_CENT,
      "totalInterestAccrued with late fees"
    );
    assertApproxEqAbs(
      cl.interestAccrued(),
      expectedInterestAccrued + interestAccruedLateFees,
      HUNDREDTH_CENT,
      "interestAccrued with late fees"
    );
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

    uint256 totalRegIntAccrued = getInterestAccrued(
      block.timestamp,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 lateFeesStartAt = s.nextDueTimeAt(block.timestamp, cl.lastFullPaymentTime()) +
      gfConfig.getLatenessGracePeriodInDays() *
      (1 days);
    uint256 totalLateIntAccrued = getInterestAccrued(
      lateFeesStartAt,
      timestamp,
      cl.balance(),
      cl.lateFeeApr()
    );

    assertApproxEqAbs(cl.totalInterestAccruedAt(timestamp), totalRegIntAccrued, HUNDREDTH_CENT);
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

    // Calculate regular interest that has accrued in the current period (from last due time
    // until timestamp)
    uint256 regIntAccrued = getInterestAccrued(
      s.previousInterestDueTimeAt(block.timestamp, timestamp),
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    // Calculate late fee interest in the current period
    uint256 lateFeesStartAt = s.nextDueTimeAt(block.timestamp, cl.lastFullPaymentTime());
    if (lateFeesStartAt < s.previousInterestDueTimeAt(block.timestamp, timestamp)) {
      lateFeesStartAt = s.previousInterestDueTimeAt(block.timestamp, timestamp);
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

    // Does not account for future late interest
    assertApproxEqAbs(cl.interestAccruedAt(timestamp), regIntAccrued, HUNDREDTH_CENT);
    vm.warp(timestamp);

    // Accounts for late fees that have accrued in the past.
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

    uint256 regIntOwed = getInterestAccrued(
      block.timestamp,
      s.previousInterestDueTimeAt(block.timestamp, timestamp),
      cl.balance(),
      cl.interestApr()
    );

    uint256 lateFeesStartAt = s.nextDueTimeAt(block.timestamp, cl.lastFullPaymentTime()) +
      gfConfig.getLatenessGracePeriodInDays() *
      (1 days);
    uint256 lateIntOwed;
    if (lateFeesStartAt < s.previousInterestDueTimeAt(block.timestamp, timestamp)) {
      lateIntOwed = getInterestAccrued(
        lateFeesStartAt,
        s.previousInterestDueTimeAt(block.timestamp, timestamp),
        cl.balance(),
        cl.lateFeeApr()
      );
    }

    assertApproxEqAbs(cl.interestOwedAt(timestamp), regIntOwed, HUNDREDTH_CENT);
    vm.warp(timestamp);
    assertApproxEqAbs(cl.interestOwed(), regIntOwed + lateIntOwed, HUNDREDTH_CENT);
  }

  function testAccountingVarsCrossingTermEndTime(
    uint256 timestamp,
    address depositor,
    uint256 depositAmount,
    uint256 drawdownAmount
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();

    vm.assume(fuzzHelper.isAllowed(depositor));
    depositAmount = bound(depositAmount, 1, 100_000_000);
    drawdownAmount = bound(depositAmount, 0, depositAmount);
    fundAddress(depositor, depositAmount);
    uid._mintForTest(depositor, 1, 1, "");
    deposit(callableLoan, depositAmount, depositor);
    drawdown(callableLoan, drawdownAmount);
    timestamp = bound(timestamp, cl.termEndTime(), cl.termEndTime() + 1000 days);

    uint256 expectedTotalInterestAccrued = getInterestAccrued(
      block.timestamp,
      timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 expectedInterestOwed = expectedTotalInterestAccrued;
    uint256 expectedPrincipalOwed = cl.balance();

    uint256 expectedTotalInterestAccruedLateFees = getInterestAccrued(
      cl.nextDueTime() + lateGracePeriodInDays,
      timestamp,
      cl.balance(),
      cl.lateFeeApr()
    );

    assertApproxEqAbs(
      cl.totalInterestAccruedAt(timestamp),
      expectedTotalInterestAccrued,
      HUNDREDTH_CENT
    );
    assertApproxEqAbs(cl.interestOwedAt(timestamp), expectedInterestOwed, HUNDREDTH_CENT);
    assertZero(cl.interestAccruedAt(timestamp));

    vm.warp(timestamp);

    assertApproxEqAbs(cl.totalPrincipalOwed(), expectedPrincipalOwed, HUNDREDTH_CENT);
    assertApproxEqAbs(
      cl.totalInterestAccrued(),
      expectedTotalInterestAccrued + expectedTotalInterestAccruedLateFees,
      HUNDREDTH_CENT
    );
    assertApproxEqAbs(
      cl.interestOwed(),
      expectedInterestOwed + expectedTotalInterestAccruedLateFees,
      HUNDREDTH_CENT
    );
    assertZero(cl.interestAccrued());
  }

  function testAccountingVarsDoNotAccumulateWhenBalanceIsZero(
    uint256 firstJump,
    uint256 lastJump
  ) public {
    (CallableLoan callableLoan, ICreditLine cl) = defaultCallableLoan();
    depositAndDrawdown(callableLoan, usdcVal(1000), GF_OWNER);

    // Advance to random time after drawdown period and pay back everything
    warpToAfterDrawdownPeriod(callableLoan);
    firstJump = bound(firstJump, block.timestamp, cl.termEndTime());
    vm.warp(firstJump);

    uint256 nextPrincipalDueTime = callableLoan.nextPrincipalDueTime();
    pay(
      callableLoan,
      cl.interestAccruedAt(nextPrincipalDueTime) +
        cl.interestOwedAt(nextPrincipalDueTime) +
        cl.balance()
    );
    assertZero(cl.balance());
    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());

    // Advance to next due time - interest or principal
    uint256 nextDueTimeJump = callableLoan.nextDueTime();
    vm.warp(nextDueTimeJump);
    assertZero(cl.balance());
    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());

    // Advance to next principal payment period in order for principal payment to process.
    uint256 nextPrincipalDueTimeJump = callableLoan.nextPrincipalDueTime();
    vm.warp(nextPrincipalDueTimeJump);
    assertZero(cl.balance());
    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());

    // // // Advance to a random time and assert amounts owed have not changed
    lastJump = bound(lastJump, firstJump, firstJump + 1000 days);
    vm.warp(lastJump);
    assertZero(cl.balance());
    assertZero(cl.interestOwed());
    assertZero(cl.interestAccrued());
  }

  function testTotalInterestAccruedAtWhereLastFullPaymentTimeLandsOnPrincipalDueTime() public {
    // TODO
  }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import "../../../external/FixedPoint.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {BaseTest} from "../../core/BaseTest.t.sol";
import {TestCreditLine} from "../../../test/TestCreditLine.sol";
import {AccountantTestHelpers} from "./AccountantTestHelpers.t.sol";
import {TestConstants} from "../../core/TestConstants.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";

contract AccountantTest is BaseTest, AccountantTestHelpers {
  using FixedPoint for FixedPoint.Unsigned;

  address internal constant BORROWER = 0x228994aE78d75939A5aB9260a83bEEacBE77Ddd0;
  uint256 internal constant INTEREST_APR = 300000000000000000; // 3%
  uint256 internal constant PAYMENT_PERIOD_IN_DAYS = 30;
  uint256 internal constant TERM_IN_DAYS = 365;
  uint256 internal constant LATE_FEE_APR = 30000000000000000; // 3%
  uint256 internal constant GRACE_PERIOD_IN_DAYS = 1000 days;

  TestCreditLine internal cl;

  function interestOwedForOnePeriod(
    uint256 _balance,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays
  ) public pure returns (uint256) {
    uint256 paymentPeriodInSeconds = _paymentPeriodInDays * TestConstants.SECONDS_PER_DAY;
    uint256 totalInterestPerYear = (_balance * _interestApr) / TestConstants.INTEREST_DECIMALS;
    uint256 result = (totalInterestPerYear * paymentPeriodInSeconds) /
      TestConstants.SECONDS_PER_YEAR;
    return result;
  }

  function setUp() public override {
    super.setUp();

    cl = new TestCreditLine();
    cl.initialize(
      address(protocol.gfConfig()),
      PROTOCOL_OWNER,
      BORROWER,
      usdcVal(10_000_000), // max limit
      INTEREST_APR,
      PAYMENT_PERIOD_IN_DAYS,
      TERM_IN_DAYS,
      LATE_FEE_APR,
      GRACE_PERIOD_IN_DAYS
    );

    vm.startPrank(PROTOCOL_OWNER);
    cl.setInterestAccruedAsOf(block.timestamp);
    cl.setTermEndTime(block.timestamp + TERM_IN_DAYS * TestConstants.SECONDS_PER_DAY);
    cl.setBalance(usdcVal(10_000_00));
    vm.stopPrank();
  }

  /// @notice When timestamp < termEndTime then interest should accrue linearly
  /// according to the elapsed time and there should be no principal accrued
  function test_accrual_timeLtTermEndTime_linearInterest_and_noPrincipal(
    uint256 _timestamp
  ) public impersonating(PROTOCOL_OWNER) withLateFeeApr(cl, 0) {
    _timestamp = bound(
      _timestamp,
      block.timestamp,
      block.timestamp + TERM_IN_DAYS * TestConstants.SECONDS_PER_DAY - 1
    );

    (uint256 interestAccr, uint256 principalAccr) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      _timestamp,
      GRACE_PERIOD_IN_DAYS
    );

    uint256 expectedInterest = getInterestAccrued(
      cl.interestAccruedAsOf(),
      _timestamp,
      cl.balance(),
      cl.interestApr()
    );
    assertEq(interestAccr, expectedInterest, "interestAccrued");
    assertEq(principalAccr, 0, "principalAccrued");
  }

  /// @notice When the timestamp >= termEndTime then interest should accrue linearly according
  /// to the elapsed time and there should be 100% of principal accrued
  function test_accrual_timeGteTermEndTime_linearInterest_and_allPrincipal(
    uint256 _timestamp
  ) public impersonating(PROTOCOL_OWNER) withLateFeeApr(cl, 0) {
    _timestamp = bound(
      _timestamp,
      block.timestamp + TERM_IN_DAYS * TestConstants.SECONDS_PER_DAY,
      block.timestamp + TERM_IN_DAYS * TestConstants.SECONDS_PER_DAY * 2
    );

    (uint256 interestAccr, uint256 principalAccr) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      _timestamp,
      GRACE_PERIOD_IN_DAYS
    );

    uint256 expectedInterest = getInterestAccrued(
      cl.interestAccruedAsOf(),
      _timestamp,
      cl.balance(),
      cl.interestApr()
    );
    assertEq(interestAccr, expectedInterest, "interestAccrued");
    assertEq(principalAccr, cl.balance(), "principalAccrued");
  }

  /// @notice If we are before the termEndTime and the timestamp is on the
  /// interval[nextDueTime, nextDueTime + gracePeriod] then we should not be
  /// charged any late fees
  function test_accrual_timeWithinGracePeriod_noLateFees(
    uint256 _timestamp
  )
    public
    impersonating(PROTOCOL_OWNER)
    withLateFeeApr(cl, LATE_FEE_APR)
    withNextDueTime(cl, block.timestamp + PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY)
  {
    uint256 nextDueTime = cl.nextDueTime();
    uint256 lateFeeGracePeriod = 7 days;
    _timestamp = bound(_timestamp, nextDueTime, nextDueTime + lateFeeGracePeriod);

    (uint256 interestAccr, uint256 principalAccr) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      _timestamp,
      lateFeeGracePeriod / TestConstants.SECONDS_PER_DAY
    );

    uint256 expectedInterest = getInterestAccrued(
      cl.interestAccruedAsOf(),
      _timestamp,
      cl.balance(),
      cl.interestApr()
    );
    assertEq(interestAccr, expectedInterest, "interestAccrued");
    assertEq(principalAccr, 0, "principalAccrued");
  }

  /// @notice If we are before the termEndtime but the timestamp is after nextDueTime + gracePeriod
  /// then we should be charged late fees on the seconds elapsed between [nextDueTime + gracePeriod, timestamp]
  function test_accrual_timeAfterGracePeriod_hasLateFees(
    uint256 _timestamp
  )
    public
    impersonating(PROTOCOL_OWNER)
    withLateFeeApr(cl, LATE_FEE_APR)
    withNextDueTime(cl, block.timestamp + PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY)
  {
    uint256 nextDueTime = cl.nextDueTime();
    uint256 lateFeeGracePeriod = 7 days;
    _timestamp = bound(_timestamp, nextDueTime + lateFeeGracePeriod, cl.termEndTime() - 1);

    (uint256 interestAccr, uint256 principalAccr) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      _timestamp,
      lateFeeGracePeriod / TestConstants.SECONDS_PER_DAY
    );

    uint256 expectedInterest = getInterestAccrued(
      cl.interestAccruedAsOf(),
      _timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 expectedLateFee = getInterestAccrued(
      nextDueTime + lateFeeGracePeriod,
      _timestamp,
      cl.balance(),
      cl.lateFeeApr()
    );

    assertEq(interestAccr, expectedInterest + expectedLateFee, "interestAccrued with late fees");
    assertEq(principalAccr, 0, "principalAccrued");
  }

  /// @notice If we are past the termEndTime but within the lateFeeApr grace period then late fees
  /// do not apply
  function test_lateFeeGracePeriod_still_applies_after_termEndTime(
    uint256 _timestamp
  )
    public
    impersonating(PROTOCOL_OWNER)
    withLateFeeApr(cl, LATE_FEE_APR)
    withNextDueTime(cl, cl.termEndTime())
  {
    uint256 lateFeeGracePeriod = 7 days;
    _timestamp = bound(_timestamp, cl.termEndTime(), cl.termEndTime() + lateFeeGracePeriod);

    (uint256 interestAccr, uint256 principalAccr) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      _timestamp,
      lateFeeGracePeriod / TestConstants.SECONDS_PER_DAY
    );

    uint256 expectedInterest = getInterestAccrued(
      cl.interestAccruedAsOf(),
      _timestamp,
      cl.balance(),
      cl.interestApr()
    );

    assertEq(interestAccr, expectedInterest, "no late fees");
    assertEq(principalAccr, cl.balance(), "principalAccrued includes balance");
  }

  /// @notice When it comes to the lateFeeApr grace period, termEndTime should not be any different than a due time
  /// in the middle of the loan
  function test_interestLateFee_applies_after_grace_period_when_nextDueTime_is_termEndTime(
    uint256 _timestamp
  )
    public
    impersonating(PROTOCOL_OWNER)
    withLateFeeApr(cl, LATE_FEE_APR)
    withNextDueTime(cl, cl.termEndTime())
  {
    uint256 lateFeeGracePeriod = 7 days;
    _timestamp = bound(_timestamp, cl.termEndTime() + lateFeeGracePeriod, cl.termEndTime() * 5);

    (uint256 interestAccr, uint256 principalAccr) = Accountant.calculateInterestAndPrincipalAccrued(
      cl,
      _timestamp,
      lateFeeGracePeriod / TestConstants.SECONDS_PER_DAY
    );

    uint256 expectedInterest = getInterestAccrued(
      cl.interestAccruedAsOf(),
      _timestamp,
      cl.balance(),
      cl.interestApr()
    );
    uint256 expectedLateFee = getInterestAccrued(
      cl.termEndTime() + lateFeeGracePeriod,
      _timestamp,
      cl.balance(),
      cl.lateFeeApr()
    );
    assertEq(interestAccr, expectedInterest + expectedLateFee, "Interest with late fee");
    assertEq(principalAccr, cl.balance(), "principal accrued balance");
  }

  /// @notice Late fee should kick in based on my nextDueTime and not be affected by my lastFullPaymentTime
  function test_lateFeeStart_unchanged_on_lastFullPaymentTime_change(
    uint256 _timestamp
  ) public impersonating(PROTOCOL_OWNER) withLateFeeApr(cl, LATE_FEE_APR) {
    uint256 nextDueTime = cl.nextDueTime();
    uint256 lateFeeGracePeriod = 7 days;
    _timestamp = bound(_timestamp, nextDueTime + lateFeeGracePeriod, cl.termEndTime());

    (uint256 interestAccr1, uint256 principalAccr1) = Accountant
      .calculateInterestAndPrincipalAccrued(
        cl,
        _timestamp,
        lateFeeGracePeriod / TestConstants.SECONDS_PER_DAY
      );

    cl.setLastFullPaymentTime(block.timestamp);
    (uint256 interestAccr2, uint256 principalAccr2) = Accountant
      .calculateInterestAndPrincipalAccrued(
        cl,
        _timestamp,
        lateFeeGracePeriod / TestConstants.SECONDS_PER_DAY
      );

    assertEq(interestAccr1, interestAccr2, "accrued interest should be unchanged");
    assertEq(principalAccr1, principalAccr2, "accrued principal should be unchanged");
  }

  /// @notice If we are past the termEndTime, owe interest and/or balance, and past the writedown gracePeriod,
  /// then the principal should be written down proportionally to how close we are to maxDaysLate
  function test_writedown_when_paymentPeriod_gt_gracePeriodInDays()
    public
    impersonating(PROTOCOL_OWNER)
    withBalance(cl, usdcVal(10))
    withInterestApr(cl, 30000000000000000)
    withPaymentPeriodInDays(cl, 90)
    withInterestOwed(cl, interestOwedForOnePeriod(usdcVal(10), 30000000000000000, 90))
    withTermEndTime(cl, block.timestamp)
    withLateFeeApr(cl, 0)
  {
    // Calculate for 100 seconds in the future
    vm.warp(block.timestamp + 100);

    // 90 paymentPeriodInDays
    // 30 gracePeriodInDays
    // 120 maxDaysLate
    // 90 daysLate
    // Expected writedown %: (daysLate - gracePeriod) / maxDaysLate = (90 - 30) / 120 = 50%
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      30, // gracePeriodInDays
      120 // maxDaysLate
    );

    assertEq(writedownPercent, 50, "writedownPercent should be 50%");
    assertApproxEqAbs(
      writedownAmount,
      cl.balance() / 2,
      TOLERANCE,
      "writedownAmount should be half the balance"
    );
  }

  /// @notice If we are past termEndTime, owe interest and/or balance, and before the grace period,
  /// then the principal should not be written down
  function test_zeroWritedown_within_gracePeriod(
    uint256 gracePeriodInDays,
    uint256 daysOfInterestOwed
  )
    public
    impersonating(PROTOCOL_OWNER)
    withPaymentPeriodInDays(cl, 30)
    withTermEndTime(cl, block.timestamp)
  {
    // Set gracePeriodInDays within reasonable bounds
    gracePeriodInDays = bound(gracePeriodInDays, 7, 90);
    daysOfInterestOwed = bound(daysOfInterestOwed, 0, gracePeriodInDays);
    cl.setInterestOwed(
      getInterestAccrued(
        0,
        daysOfInterestOwed * TestConstants.SECONDS_PER_DAY,
        cl.balance(),
        cl.interestApr()
      )
    );

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      gracePeriodInDays
    );

    assertEq(writedownPercent, 0, "writedownPercent should be 0");
    assertEq(writedownAmount, 0, "writedownAmount should be 0");
  }

  /// @notice If we are past the termEndTime, owe interest and/or balance, and past the gracePeriod,
  /// then the principal should be written down proportionally to how close we are to maxDaysLate
  function test_writesDown_linearly_after_gracePeriod(
    uint256 gracePeriodInDays,
    uint256 maxDaysLate,
    uint256 daysOfInterestOwed
  )
    public
    impersonating(PROTOCOL_OWNER)
    withPaymentPeriodInDays(cl, 30)
    withTermEndTime(cl, block.timestamp)
  {
    // Set gracePeriodInDays within reasonable bounds
    gracePeriodInDays = bound(gracePeriodInDays, 7, 90);
    // Set maxDaysLate within reasonable bounds (but must be greater than or equal to grace period in days)
    maxDaysLate = bound(maxDaysLate, gracePeriodInDays + 1, 120);
    // days of interest owed should exceed the gracePeriodInDays
    daysOfInterestOwed = bound(daysOfInterestOwed, gracePeriodInDays + 1, maxDaysLate);
    cl.setInterestOwed(
      getInterestAccrued(
        0,
        daysOfInterestOwed * TestConstants.SECONDS_PER_DAY,
        cl.balance(),
        cl.interestApr()
      )
    );

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    FixedPoint.Unsigned memory expectedWritedownPercent = getPercentage(
      cl,
      gracePeriodInDays,
      maxDaysLate
    );
    assertEq(
      writedownPercent,
      expectedWritedownPercent.mul(100).div(10 ** 18).rawValue,
      "writedown percent should be proportional"
    );

    uint256 expectedWritedownAmount = expectedWritedownPercent
      .mul(cl.balance())
      .div(10 ** 18)
      .rawValue;
    assertEq(writedownAmount, expectedWritedownAmount, "writedown amount should be proportional");
  }

  /// @notice If the daysLate exceeds maxDaysLate then the writedownPercent should be capped at
  // 100%
  function test_writeDown_caps_at_100_after_maxDaysLate(
    uint256 gracePeriodInDays,
    uint256 maxDaysLate,
    uint256 daysOfInterestOwed
  )
    public
    impersonating(PROTOCOL_OWNER)
    withPaymentPeriodInDays(cl, 30)
    withTermEndTime(cl, block.timestamp)
  {
    gracePeriodInDays = bound(gracePeriodInDays, 7, 90);
    maxDaysLate = bound(maxDaysLate, gracePeriodInDays, 120);
    vm.assume(
      daysOfInterestOwed > gracePeriodInDays + maxDaysLate && daysOfInterestOwed <= 10000000000
    );
    cl.setInterestOwed(
      getInterestAccrued(
        0,
        daysOfInterestOwed * TestConstants.SECONDS_PER_DAY,
        cl.balance(),
        cl.interestApr()
      )
    );

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    assertEq(writedownPercent, 100, "writedownPercent should be 100");
    assertEq(writedownAmount, cl.balance(), "writedownAmount should be full balance");
  }

  /// @notice If there is no balance on the credit line then nothing should be written down,
  /// even if there is interest/principal owed
  function test_if_zero_balance_then_zero_writedown(
    uint256 daysOfInterestOwed
  ) public impersonating(PROTOCOL_OWNER) withBalance(cl, 0) withTermEndTime(cl, block.timestamp) {
    uint256 gracePeriodInDays = 15;
    uint256 maxDaysLate = 40;
    vm.assume(daysOfInterestOwed > gracePeriodInDays && daysOfInterestOwed <= 500);
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    assertEq(writedownPercent, 0, "writedownPercent should be 0");
    assertEq(writedownAmount, 0, "writedownAmount should be 0");
  }

  /// @notice When past termEndTime the current timestamp should be used to determine if we're in the
  /// grace period
  function test_writedown_uses_timestamp_to_check_if_in_gracecPeriod_past_termEndTime()
    public
    impersonating(PROTOCOL_OWNER)
    withTermEndTime(cl, block.timestamp)
    withInterestOwed(
      cl,
      getInterestAccrued(0, TestConstants.SECONDS_PER_DAY, cl.balance(), cl.interestApr())
    )
  {
    skip(block.timestamp + (PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY) / 2);
    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    assertEq(
      writedownPercent,
      0,
      "writedown percent should be 0 within grace period after termEndTime"
    );
    assertEq(
      writedownAmount,
      0,
      "writedown amount should be 0 within grace period after termEndTime"
    );
  }

  /// @notice Crossing the termEndTime should not be a significant event, in that the writedown is computed
  /// the same as if we crossed an arbitrary point in time
  function test_writedown_no_change_when_you_just_cross_termEndTime()
    public
    impersonating(PROTOCOL_OWNER)
    withBalance(cl, usdcVal(10))
    withTermEndTime(cl, block.timestamp + 2)
    withInterestApr(cl, 30000000000000000)
    withInterestOwed(
      cl,
      interestOwedForOnePeriod(usdcVal(10), 30000000000000000, PAYMENT_PERIOD_IN_DAYS) * 2
    )
  {
    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    uint256 timestamp = block.timestamp; // 2 seconds before termEndTime
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertApproxEqAbs(writedownPercent, 25, 1, "writedownPercent should be 25");
    assertApproxEqAbs(
      writedownAmount,
      (cl.balance() * 25) / 100,
      TOLERANCE,
      "writedownAmount should be 25% of balance"
    );

    timestamp = block.timestamp + 2; // 1 second after termEndTerm
    (writedownPercent, writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertApproxEqAbs(writedownPercent, 25, 1, "writedownPercent should still be 25");
    assertApproxEqAbs(
      writedownAmount,
      (cl.balance() * 25) / 100,
      TOLERANCE,
      "writedownAmount should still be 25% of balance"
    );
  }

  /// @notice We should have proportional writedowns after termEndTime, same as before. The
  /// main difference here is that daysLate will include the seconds elapsed after termEndTime.
  function test_writedown_past_termEndTime_uses_timestamp_to_writedown_linearly(
    uint256 daysAfterTermEndTime
  )
    public
    impersonating(PROTOCOL_OWNER)
    withTermEndTime(cl, block.timestamp)
    withInterestOwed(
      cl,
      getInterestAccrued(
        0,
        PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY + 10,
        cl.balance(),
        cl.interestApr()
      )
    )
  {
    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    // daysLate = 30 (from interest owed) + daysAfterTermEndTime
    // we want days late to fall in the range [gracePeriodInDays, maxDaysLate]
    // to test writedown proportionality, so
    // 30 + daysAfterTermEndTime > gracePeriodInDays && 30 + daysAfterTermEndTime < maxDaysLate
    // => daysAfterTermEndTime > 0 && daysAfterTermEndTime < 90
    vm.assume(daysAfterTermEndTime > 0 && daysAfterTermEndTime < 90);
    skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    FixedPoint.Unsigned memory expectedWritedownPercent = getPercentage(
      cl,
      gracePeriodInDays,
      maxDaysLate
    );
    assertEq(
      writedownPercent,
      expectedWritedownPercent.mul(100).div(10 ** 18).rawValue,
      "writedownPercent should be proportional"
    );

    uint256 expectedWritedownAmount = expectedWritedownPercent
      .mul(cl.balance())
      .div(10 ** 18)
      .rawValue;
    assertEq(writedownAmount, expectedWritedownAmount, "writedownAmount should be proportional");
  }

  /// @notice Just like before termEndTime, the writedown percent should not exceed 100% under
  /// any circumstances
  function test_writedown_past_termEndTime_caps_at_100(
    uint256 daysAfterTermEndTime
  )
    public
    impersonating(PROTOCOL_OWNER)
    withTermEndTime(cl, block.timestamp)
    withInterestOwed(
      cl,
      getInterestAccrued(
        0,
        PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY,
        cl.balance(),
        cl.interestApr()
      )
    )
  {
    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    daysAfterTermEndTime = bound(daysAfterTermEndTime, 150, 500);
    skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);

    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );

    assertEq(writedownPercent, 100, "writedownPercent should be 100");
    assertEq(writedownAmount, cl.balance(), "writedownAmount should be full balance");
  }

  /// @notice Past termEndTime nothing should be written down if the credit line has no balance
  function test_no_writedown_for_zero_balance_past_termEndTime(
    uint256 daysAfterTermEndTime
  ) public impersonating(PROTOCOL_OWNER) withTermEndTime(cl, block.timestamp) withBalance(cl, 0) {
    uint256 gracePeriodInDays = 30;
    uint256 maxDaysLate = 120;
    daysAfterTermEndTime = bound(daysAfterTermEndTime, gracePeriodInDays, 500);
    skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);
    (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
      cl,
      block.timestamp,
      gracePeriodInDays,
      maxDaysLate
    );
    assertEq(writedownPercent, 0, "writedownPercent should be 0");
    assertEq(writedownAmount, 0, "writedownAmount should be 0");
  }

  /// @notice when the interestOwed exceeds paymentAmount then the
  /// entire payment amount should go to interestOwed
  function test_allocatePayment_upTo_interestOwed(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) public {
    paymentAmount = bound(paymentAmount, 0, interestOwed);
    Accountant.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      balance,
      interestOwed,
      principalOwed
    );
    assertEq(pa.interestPayment, paymentAmount, "Entire payment should go to interest");
    assertEq(pa.principalPayment, 0, "None of the payment should go to principal");
    assertEq(pa.additionalBalancePayment, 0, "None of the payment should go to balance");
  }

  /// @notice when the payment amount is between [interestOwed, interestOwed + principalOwed]
  /// then all interest owed should be payed and whatever is left should go to principalOwed
  function test_allocatePayment_upTo_principalOwed(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) public {
    // Make sure the sum of the debts doesn't exceed the max int
    interestOwed = bound(interestOwed, 0, type(uint256).max / 2);
    principalOwed = bound(principalOwed, 0, type(uint256).max / 2);
    paymentAmount = bound(paymentAmount, interestOwed, interestOwed + principalOwed);
    vm.assume(balance >= principalOwed);

    Accountant.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      balance,
      interestOwed,
      principalOwed
    );
    assertEq(pa.interestPayment, interestOwed, "Repaid full interest owed");
    assertEq(pa.principalPayment, paymentAmount - interestOwed, "Repaid remaining after interest");
    assertEq(pa.additionalBalancePayment, 0, "None of the payment should go to balance");
  }

  /// @notice when paymentAmount exceeds interestOwed + principalOwed
  /// then interestOwed and principalOwed should be fully paid, and if
  /// if there is any remaining balance is should be reduced by the
  /// leftover payment amount
  function test_allocatePayment_upTo_balance(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) public {
    // Make sure the sum of the debts doesn't exceed the max int
    interestOwed = bound(interestOwed, 0, type(uint256).max / 3);
    principalOwed = bound(principalOwed, 0, type(uint256).max / 3);
    balance = bound(balance, 0, type(uint256).max / 3);
    paymentAmount = bound(paymentAmount, interestOwed + principalOwed, type(uint256).max);
    vm.assume(balance >= principalOwed);

    Accountant.PaymentAllocation memory pa = Accountant.allocatePayment(
      paymentAmount,
      balance,
      interestOwed,
      principalOwed
    );

    assertEq(pa.interestPayment, interestOwed, "Repaid full interest owed");
    assertEq(pa.principalPayment, principalOwed, "Repaid full principal owed");
    uint256 remainingBalance = balance - principalOwed;
    uint256 remainingPayment = paymentAmount - interestOwed - principalOwed;
    uint256 expectedAdditionalBalancePayment = remainingBalance < remainingPayment
      ? remainingBalance
      : remainingPayment;
    assertEq(
      pa.additionalBalancePayment,
      expectedAdditionalBalancePayment,
      "Repaid additional balance"
    );
  }
}

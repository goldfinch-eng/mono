// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Accountant} from "../../../protocol/core/Accountant.sol";

import {TestConstants} from "../TestConstants.t.sol";
import {AccountantBaseTest} from "./BaseAccountant.t.sol";

contract AccountantCalculateInterestAndPrincipalAccruedTest is AccountantBaseTest {
  /*
  When timestamp < termEndTime then interest should accrue linearly
  according to the elapsed time and there should be no principal accrued
  */
  function testAccrualBeforeTermEndTimeIsLinearInterestAndNoPrincipal(
    uint256 _timestamp
  ) public impersonating(GF_OWNER) withLateFeeApr(cl, 0) {
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

  /*
  When the timestamp >= termEndTime then interest should accrue linearly according
  to the elapsed time and there should be 100% of principal accrued
  */
  function testAccrualAfterTermEndTimeIsLinearInterestAndFullPrincipal(
    uint256 _timestamp
  ) public impersonating(GF_OWNER) withLateFeeApr(cl, 0) {
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

  /*
  If we are before the termEndTime and the timestamp is on the interval[nextDueTime, nextDueTime + gracePeriod]
  then we should not be charged any late fees
  */
  function testAccrualHasNoLateFeesInGracePeriod(
    uint256 _timestamp
  )
    public
    impersonating(GF_OWNER)
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

  /*
  If we are before the termEndtime but the timestamp is after nextDueTime + gracePeriod
  then we should be charged late fees on the seconds elapsed between [nextDueTime + gracePeriod, timestamp]
  */
  function testAccrualHasLateFeesAfterGracePeriod(
    uint256 _timestamp
  )
    public
    impersonating(GF_OWNER)
    withLateFeeApr(cl, LATE_FEE_APR)
    withNextDueTime(cl, block.timestamp + PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY)
    withLastFullPaymentTime(cl, block.timestamp)
  {
    uint256 nextDueTime = cl.nextDueTime();
    uint256 lateFeeGracePeriod = 7 days;
    _timestamp = bound(_timestamp, nextDueTime + lateFeeGracePeriod, cl.termEndTime());

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

  /*
  If we are past the termEndTime but within the LATE_FEE_APR grace period then late fees do not apply
  */
  function testAfterTermEndTimeLateFeeGracePeriodStillApplies(
    uint256 _timestamp
  )
    public
    impersonating(GF_OWNER)
    withLateFeeApr(cl, LATE_FEE_APR)
    withNextDueTime(cl, cl.termEndTime())
    // By setting the last full payment time to 5 days before the termEndTime we're
    // simulating a situation where the last full payment time was for the 12th period
    // on a 1 yr loan: 12 * 30 = 360 days have elapsed, and your next due time, namely
    // termEndTime, is 6 days from now
    withLastFullPaymentTime(cl, cl.termEndTime() - 5 days)
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

  /*
  When it comes to the lateFeeApr grace period, termEndTime should not be any different than a due time
  in the middle of the loan
  */
  function testInterestLateFeeAppliesAfterGracePeriodWhenNextDueTimeIsTermEndTime(
    uint256 _timestamp
  )
    public
    impersonating(GF_OWNER)
    withLateFeeApr(cl, LATE_FEE_APR)
    withNextDueTime(cl, cl.termEndTime())
    withLastFullPaymentTime(cl, cl.termEndTime() - 5 days)
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
}

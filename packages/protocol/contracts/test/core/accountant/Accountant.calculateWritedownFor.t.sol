// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import {FixedPoint} from "../../../external/FixedPoint.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {AccountantBaseTest} from "./BaseAccountant.t.sol";
import {TestCreditLine} from "../../../test/TestCreditLine.sol";
import {TestConstants} from "../TestConstants.t.sol";
import {GoldfinchConfig} from "../../../protocol/core/GoldfinchConfig.sol";

contract AccountantCalculateWritedownForTest is AccountantBaseTest {
  // TODO(will)
  /*
  If we are past the termEndTime, owe interest and/or balance, and past the writedown gracePeriod,
  then the principal should be written down proportionally to how close we are to maxDaysLate
  */
  // function testWritedownWhenPaymentPeriodGtGracePeriodInDays()
  //   public
  //   impersonating(GF_OWNER)
  //   withBalance(cl, usdcVal(10))
  //   withInterestApr(cl, 30000000000000000)
  //   withPaymentPeriodInDays(cl, 90)
  //   withInterestOwed(cl, interestOwedForOnePeriod(usdcVal(10), 30000000000000000, 90))
  //   withTermEndTime(cl, block.timestamp)
  //   withLateFeeApr(cl, 0)
  // {
  //   // Calculate for 100 seconds in the future
  //   vm.warp(block.timestamp + 100);
  //   // 90 paymentPeriodInDays
  //   // 30 gracePeriodInDays
  //   // 120 maxDaysLate
  //   // 90 daysLate
  //   // Expected writedown %: (daysLate - gracePeriod) / maxDaysLate = (90 - 30) / 120 = 50%
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     30, // gracePeriodInDays
  //     120 // maxDaysLate
  //   );
  //   assertEq(writedownPercent, 50, "writedownPercent should be 50%");
  //   assertApproxEqAbs(
  //     writedownAmount,
  //     cl.balance() / 2,
  //     TOLERANCE,
  //     "writedownAmount should be half the balance"
  //   );
  // }
  // /*
  // If we are past termEndTime, owe interest and/or balance, and before the grace period,
  // then the principal should not be written down
  // */
  // function testZeroWritedownWithinGracePeriod(
  //   uint256 gracePeriodInDays,
  //   uint256 daysOfInterestOwed
  // )
  //   public
  //   impersonating(GF_OWNER)
  //   withPaymentPeriodInDays(cl, 30)
  //   withTermEndTime(cl, block.timestamp)
  // {
  //   // Set gracePeriodInDays within reasonable bounds
  //   gracePeriodInDays = bound(gracePeriodInDays, 7, 90);
  //   daysOfInterestOwed = bound(daysOfInterestOwed, 0, gracePeriodInDays);
  //   // TODO(will)
  //   // cl.setInterestOwed(
  //   //   getInterestAccrued(
  //   //     0,
  //   //     daysOfInterestOwed * TestConstants.SECONDS_PER_DAY,
  //   //     cl.balance(),
  //   //     cl.interestApr()
  //   //   )
  //   // );
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     gracePeriodInDays
  //   );
  //   assertEq(writedownPercent, 0, "writedownPercent should be 0");
  //   assertEq(writedownAmount, 0, "writedownAmount should be 0");
  // }
  // /*
  // If we are past the termEndTime, owe interest and/or balance, and past the gracePeriod,
  // then the principal should be written down proportionally to how close we are to maxDaysLate
  // */
  // function testWritedownLinearlyAfterGracePeriod(
  //   uint256 gracePeriodInDays,
  //   uint256 maxDaysLate,
  //   uint256 daysOfInterestOwed
  // )
  //   public
  //   impersonating(GF_OWNER)
  //   withPaymentPeriodInDays(cl, 30)
  //   withTermEndTime(cl, block.timestamp)
  // {
  //   // Set gracePeriodInDays within reasonable bounds
  //   gracePeriodInDays = bound(gracePeriodInDays, 7, 90);
  //   // Set maxDaysLate within reasonable bounds (but must be greater than or equal to grace period in days)
  //   maxDaysLate = bound(maxDaysLate, gracePeriodInDays + 1, 120);
  //   // days of interest owed should exceed the gracePeriodInDays
  //   daysOfInterestOwed = bound(daysOfInterestOwed, gracePeriodInDays + 1, maxDaysLate);
  //   // TODO(will)
  //   // cl.setInterestOwed(
  //   //   getInterestAccrued(
  //   //     0,
  //   //     daysOfInterestOwed * TestConstants.SECONDS_PER_DAY,
  //   //     cl.balance(),
  //   //     cl.interestApr()
  //   //   )
  //   // );
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   FixedPoint.Unsigned memory expectedWritedownPercent = getPercentage(
  //     cl,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertEq(
  //     writedownPercent,
  //     expectedWritedownPercent.mul(100).div(10 ** 18).rawValue,
  //     "writedown percent should be proportional"
  //   );
  //   uint256 expectedWritedownAmount = expectedWritedownPercent
  //     .mul(cl.balance())
  //     .div(10 ** 18)
  //     .rawValue;
  //   assertEq(writedownAmount, expectedWritedownAmount, "writedown amount should be proportional");
  // }
  // /*
  // If the daysLate exceeds maxDaysLate then the writedownPercent should be capped at 100%
  // */
  // function testWritedownCapsAt100PercentAfterMaxDaysLate(
  //   uint256 gracePeriodInDays,
  //   uint256 maxDaysLate,
  //   uint256 daysOfInterestOwed
  // )
  //   public
  //   impersonating(GF_OWNER)
  //   withPaymentPeriodInDays(cl, 30)
  //   withTermEndTime(cl, block.timestamp)
  // {
  //   gracePeriodInDays = bound(gracePeriodInDays, 7, 90);
  //   maxDaysLate = bound(maxDaysLate, gracePeriodInDays, 120);
  //   vm.assume(
  //     daysOfInterestOwed > gracePeriodInDays + maxDaysLate && daysOfInterestOwed <= 10000000000
  //   );
  //   // TODO(will)
  //   // cl.setInterestOwed(
  //   //   getInterestAccrued(
  //   //     0,
  //   //     daysOfInterestOwed * TestConstants.SECONDS_PER_DAY,
  //   //     cl.balance(),
  //   //     cl.interestApr()
  //   //   )
  //   // );
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertEq(writedownPercent, 100, "writedownPercent should be 100");
  //   assertEq(writedownAmount, cl.balance(), "writedownAmount should be full balance");
  // }
  // /*
  // If there is no balance on the credit line then nothing should be written down,
  // even if there is interest/principal owed
  // */
  // function testIfZeroBalanceThenZeroWritedown(
  //   uint256 daysOfInterestOwed
  // ) public impersonating(GF_OWNER) withBalance(cl, 0) withTermEndTime(cl, block.timestamp) {
  //   uint256 gracePeriodInDays = 15;
  //   uint256 maxDaysLate = 40;
  //   vm.assume(daysOfInterestOwed > gracePeriodInDays && daysOfInterestOwed <= 500);
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertEq(writedownPercent, 0, "writedownPercent should be 0");
  //   assertEq(writedownAmount, 0, "writedownAmount should be 0");
  // }
  // /*
  // When past termEndTime the current timestamp should be used to determine if we're in the
  // grace period
  // */
  // function testWritedownUsesTimestampToCheckIfInGracecPeriodPastTermEndTime()
  //   public
  //   impersonating(GF_OWNER)
  //   withTermEndTime(cl, block.timestamp)
  //   withInterestOwed(
  //     cl,
  //     getInterestAccrued(0, TestConstants.SECONDS_PER_DAY, cl.balance(), cl.interestApr())
  //   )
  // {
  //   skip(block.timestamp + (PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY) / 2);
  //   uint256 gracePeriodInDays = 30;
  //   uint256 maxDaysLate = 120;
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertEq(
  //     writedownPercent,
  //     0,
  //     "writedown percent should be 0 within grace period after termEndTime"
  //   );
  //   assertEq(
  //     writedownAmount,
  //     0,
  //     "writedown amount should be 0 within grace period after termEndTime"
  //   );
  // }
  // /*
  // Crossing the termEndTime should not be a significant event, in that the writedown is computed
  // the same as if we crossed an arbitrary point in time
  // */
  // function testWritedownNoChangeWhenYouJustCrossTermEndTime()
  //   public
  //   impersonating(GF_OWNER)
  //   withBalance(cl, usdcVal(10))
  //   withTermEndTime(cl, block.timestamp + 2)
  //   withInterestApr(cl, 30000000000000000)
  //   withInterestOwed(
  //     cl,
  //     interestOwedForOnePeriod(usdcVal(10), 30000000000000000, PAYMENT_PERIOD_IN_DAYS) * 2
  //   )
  // {
  //   uint256 gracePeriodInDays = 30;
  //   uint256 maxDaysLate = 120;
  //   uint256 timestamp = block.timestamp; // 2 seconds before termEndTime
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertApproxEqAbs(writedownPercent, 25, 1, "writedownPercent should be 25");
  //   assertApproxEqAbs(
  //     writedownAmount,
  //     (cl.balance() * 25) / 100,
  //     TOLERANCE,
  //     "writedownAmount should be 25% of balance"
  //   );
  //   timestamp = block.timestamp + 2; // 1 second after termEndTerm
  //   (writedownPercent, writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertApproxEqAbs(writedownPercent, 25, 1, "writedownPercent should still be 25");
  //   assertApproxEqAbs(
  //     writedownAmount,
  //     (cl.balance() * 25) / 100,
  //     TOLERANCE,
  //     "writedownAmount should still be 25% of balance"
  //   );
  // }
  // /*
  // We should have proportional writedowns after termEndTime, same as before. The
  // main difference here is that daysLate will include the seconds elapsed after termEndTime.
  // */
  // function testWritedownPastTermEndTimeUsesTimestampToWritedownLinearly(
  //   uint256 daysAfterTermEndTime
  // )
  //   public
  //   impersonating(GF_OWNER)
  //   withTermEndTime(cl, block.timestamp)
  //   withInterestOwed(
  //     cl,
  //     getInterestAccrued(
  //       0,
  //       PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY + 10,
  //       cl.balance(),
  //       cl.interestApr()
  //     )
  //   )
  // {
  //   uint256 gracePeriodInDays = 30;
  //   uint256 maxDaysLate = 120;
  //   // daysLate = 30 (from interest owed) + daysAfterTermEndTime
  //   // we want days late to fall in the range [gracePeriodInDays, maxDaysLate]
  //   // to test writedown proportionality, so
  //   // 30 + daysAfterTermEndTime > gracePeriodInDays && 30 + daysAfterTermEndTime < maxDaysLate
  //   // => daysAfterTermEndTime > 0 && daysAfterTermEndTime < 90
  //   vm.assume(daysAfterTermEndTime > 0 && daysAfterTermEndTime < 90);
  //   skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   FixedPoint.Unsigned memory expectedWritedownPercent = getPercentage(
  //     cl,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertEq(
  //     writedownPercent,
  //     expectedWritedownPercent.mul(100).div(10 ** 18).rawValue,
  //     "writedownPercent should be proportional"
  //   );
  //   uint256 expectedWritedownAmount = expectedWritedownPercent
  //     .mul(cl.balance())
  //     .div(10 ** 18)
  //     .rawValue;
  //   assertEq(writedownAmount, expectedWritedownAmount, "writedownAmount should be proportional");
  // }
  // /*
  // Just like before termEndTime, the writedown percent should not exceed 100% under
  // any circumstances
  // */
  // function testWritedownPastTermEndTimeCapsAt100Percent(
  //   uint256 daysAfterTermEndTime
  // )
  //   public
  //   impersonating(GF_OWNER)
  //   withTermEndTime(cl, block.timestamp)
  //   withInterestOwed(
  //     cl,
  //     getInterestAccrued(
  //       0,
  //       PAYMENT_PERIOD_IN_DAYS * TestConstants.SECONDS_PER_DAY,
  //       cl.balance(),
  //       cl.interestApr()
  //     )
  //   )
  // {
  //   uint256 gracePeriodInDays = 30;
  //   uint256 maxDaysLate = 120;
  //   daysAfterTermEndTime = bound(daysAfterTermEndTime, 150, 500);
  //   skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertEq(writedownPercent, 100, "writedownPercent should be 100");
  //   assertEq(writedownAmount, cl.balance(), "writedownAmount should be full balance");
  // }
  // /*
  // Past termEndTime nothing should be written down if the credit line has no balance
  // */
  // function testNoWritedownForZeroBalancePastTermEndTime(
  //   uint256 daysAfterTermEndTime
  // ) public impersonating(GF_OWNER) withTermEndTime(cl, block.timestamp) withBalance(cl, 0) {
  //   uint256 gracePeriodInDays = 30;
  //   uint256 maxDaysLate = 120;
  //   daysAfterTermEndTime = bound(daysAfterTermEndTime, gracePeriodInDays, 500);
  //   skip(block.timestamp + daysAfterTermEndTime * TestConstants.SECONDS_PER_DAY);
  //   (uint256 writedownPercent, uint256 writedownAmount) = Accountant.calculateWritedownFor(
  //     cl,
  //     block.timestamp,
  //     gracePeriodInDays,
  //     maxDaysLate
  //   );
  //   assertEq(writedownPercent, 0, "writedownPercent should be 0");
  //   assertEq(writedownAmount, 0, "writedownAmount should be 0");
  // }
}

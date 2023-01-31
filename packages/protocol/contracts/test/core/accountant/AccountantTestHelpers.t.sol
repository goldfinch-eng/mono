// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "forge-std/Test.sol";
import "../../../external/FixedPoint.sol";
import {Accountant} from "../../../protocol/core/Accountant.sol";
import {TestCreditLine} from "../../../test/TestCreditLine.sol";
import {TestConstants} from "../../core/TestConstants.sol";

contract AccountantTestHelpers {
  using FixedPoint for FixedPoint.Unsigned;

  uint256 internal TOLERANCE = 10 ** TestConstants.USDC_DECIMALS / 1000; // $0.001

  function getInterestAccrued(
    uint256 start,
    uint256 end,
    uint256 amount,
    uint256 apr
  ) internal pure returns (uint256) {
    uint256 secondsElapsed = end - start;
    uint256 totalIntPerYear = (amount * apr) / TestConstants.INTEREST_DECIMALS;
    return (totalIntPerYear * secondsElapsed) / TestConstants.SECONDS_PER_YEAR;
  }

  function getPercentage(
    TestCreditLine cl,
    uint256 gracePeriodInDays,
    uint256 maxDaysLate
  ) internal view returns (FixedPoint.Unsigned memory) {
    FixedPoint.Unsigned memory fpGracePeriod = FixedPoint.fromUnscaledUint(gracePeriodInDays);
    FixedPoint.Unsigned memory fpMaxDaysLate = FixedPoint.fromUnscaledUint(maxDaysLate);

    FixedPoint.Unsigned memory amountOwedForOneDay = Accountant.calculateAmountOwedForOneDay(cl);
    uint256 totalOwed = cl.interestOwed() + cl.principalOwed();
    FixedPoint.Unsigned memory fpDaysLate = FixedPoint.fromUnscaledUint(totalOwed).div(
      amountOwedForOneDay
    );
    if (block.timestamp > cl.termEndTime()) {
      uint256 secondsLate = block.timestamp - cl.termEndTime();
      fpDaysLate = fpDaysLate.add(
        FixedPoint.fromUnscaledUint(secondsLate).div(TestConstants.SECONDS_PER_DAY)
      );
    }
    FixedPoint.Unsigned memory expectedWritedownPercent = fpDaysLate.sub(fpGracePeriod).div(
      fpMaxDaysLate
    );
    return expectedWritedownPercent;
  }

  modifier withBalance(TestCreditLine cl, uint256 _balance) {
    cl.setBalance(_balance);
    _;
  }

  modifier withLateFeeApr(TestCreditLine cl, uint256 _lateFeeApr) {
    cl.setLateFeeApr(_lateFeeApr);
    _;
  }

  modifier withInterestApr(TestCreditLine cl, uint256 _interestApr) {
    cl.setInterestApr(_interestApr);
    _;
  }

  modifier withNextDueTime(TestCreditLine cl, uint256 _nextDueTime) {
    cl.setNextDueTime(_nextDueTime);
    _;
  }

  modifier withTermEndTime(TestCreditLine cl, uint256 _termEndTime) {
    cl.setTermEndTime(_termEndTime);
    _;
  }

  modifier withInterestOwed(TestCreditLine cl, uint256 _interestOwed) {
    cl.setInterestOwed(_interestOwed);
    _;
  }

  modifier withPaymentPeriodInDays(TestCreditLine cl, uint256 _paymentPeriodInDays) {
    cl.setPaymentPeriodInDays(_paymentPeriodInDays);
    _;
  }
}

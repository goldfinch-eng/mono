// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ICreditLine} from "../../interfaces/ICreditLine.sol";
import {ILoan} from "../../interfaces/ILoan.sol";

import {ITranchedPool} from "../../interfaces/ITranchedPool.sol";
import {FixedPoint} from "../../external/FixedPoint.sol";
import {SafeMath} from "../../library/SafeMath.sol";
import {Math} from "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";

/**
 * @title The Accountant
 * @notice Library for handling key financial calculations, such as interest and principal accrual.
 * @author Goldfinch
 */

library Accountant {
  using SafeMath for uint256;
  using FixedPoint for FixedPoint.Signed;
  using FixedPoint for FixedPoint.Unsigned;
  using FixedPoint for int256;
  using FixedPoint for uint256;

  // Scaling factor used by FixedPoint.sol. We need this to convert the fixed point raw values back to unscaled
  uint256 private constant FP_SCALING_FACTOR = 10 ** 18;
  uint256 private constant INTEREST_DECIMALS = 1e18;
  uint256 private constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 private constant SECONDS_PER_YEAR = (SECONDS_PER_DAY * 365);

  function calculateWritedownFor(
    ICreditLine cl,
    uint256 timestamp,
    uint256 gracePeriodInDays,
    uint256 maxDaysLate
  ) public view returns (uint256, uint256) {
    return
      calculateWritedownForPrincipal(cl, cl.balance(), timestamp, gracePeriodInDays, maxDaysLate);
  }

  function calculateWritedownForPrincipal(
    ICreditLine cl,
    uint256 principal,
    uint256 timestamp,
    uint256 gracePeriodInDays,
    uint256 maxDaysLate
  ) public view returns (uint256, uint256) {
    FixedPoint.Unsigned memory amountOwedPerDay = calculateAmountOwedForOneDay(cl);
    if (amountOwedPerDay.isEqual(0)) {
      return (0, 0);
    }
    FixedPoint.Unsigned memory fpGracePeriod = FixedPoint.fromUnscaledUint(gracePeriodInDays);
    FixedPoint.Unsigned memory daysLate;

    // Excel math: =min(1,max(0,periods_late_in_days-graceperiod_in_days)/MAX_ALLOWED_DAYS_LATE) grace_period = 30,
    // Before the term end date, we use the interestOwed to calculate the periods late. However, after the loan term
    // has ended, since the interest is a much smaller fraction of the principal, we cannot reliably use interest to
    // calculate the periods later.
    uint256 totalOwed = cl.interestOwed().add(cl.principalOwed());
    daysLate = FixedPoint.fromUnscaledUint(totalOwed).div(amountOwedPerDay);
    if (timestamp > cl.termEndTime()) {
      uint256 secondsLate = timestamp.sub(cl.termEndTime());
      daysLate = daysLate.add(FixedPoint.fromUnscaledUint(secondsLate).div(SECONDS_PER_DAY));
    }

    FixedPoint.Unsigned memory maxLate = FixedPoint.fromUnscaledUint(maxDaysLate);
    FixedPoint.Unsigned memory writedownPercent;
    if (daysLate.isLessThanOrEqual(fpGracePeriod)) {
      // Within the grace period, we don't have to write down, so assume 0%
      writedownPercent = FixedPoint.fromUnscaledUint(0);
    } else {
      writedownPercent = FixedPoint.min(
        FixedPoint.fromUnscaledUint(1),
        (daysLate.sub(fpGracePeriod)).div(maxLate)
      );
    }

    FixedPoint.Unsigned memory writedownAmount = writedownPercent.mul(principal).div(
      FP_SCALING_FACTOR
    );
    // This will return a number between 0-100 representing the write down percent with no decimals
    uint256 unscaledWritedownPercent = writedownPercent.mul(100).div(FP_SCALING_FACTOR).rawValue;
    return (unscaledWritedownPercent, writedownAmount.rawValue);
  }

  function calculateAmountOwedForOneDay(
    ICreditLine cl
  ) public view returns (FixedPoint.Unsigned memory) {
    // Determine theoretical interestOwed for one full day
    uint256 totalInterestPerYear = cl.balance().mul(cl.interestApr()).div(INTEREST_DECIMALS);
    FixedPoint.Unsigned memory interestOwedForOneDay = FixedPoint
      .fromUnscaledUint(totalInterestPerYear)
      .div(365);
    return interestOwedForOneDay.add(cl.principalOwed());
  }

  /**
   * @notice Given a lump sum, returns the amount of the payment that should be allocated
   *         to paying interest, and the amount that should be allocated to paying principal
   */
  function splitPayment(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 interestAccrued,
    uint256 principalOwed
  ) external pure returns (uint interestPayment, uint principalPayment) {
    uint owedInterestPayment = Math.min(interestOwed, paymentAmount);
    paymentAmount = paymentAmount.sub(owedInterestPayment);

    uint owedPrincipalPayment = Math.min(principalOwed, paymentAmount);
    paymentAmount = paymentAmount.sub(owedPrincipalPayment);

    uint accruedInterestPayment = Math.min(interestAccrued, paymentAmount);
    paymentAmount = paymentAmount.sub(accruedInterestPayment);

    uint balanceRemaining = balance.sub(owedPrincipalPayment);
    uint additionalBalancePayment = Math.min(balanceRemaining, paymentAmount);

    return (
      owedInterestPayment.add(accruedInterestPayment),
      owedPrincipalPayment.add(additionalBalancePayment)
    );
  }

  /**
   * @notice Allocate a payment.
   *  1. interestOwed must be paid before principalOwed
   *  2. principalOwed must be paid before interestAccrued
   *  3. interestAccrued must be paid before the rest of the balance
   *
   * @param principalPayment payment amount allocated to principalOwed and balance
   * @param interestPayment payment amount allocated to interestOwed and interestAccrued
   * @param balance total balance on the credit line
   * @param interestOwed interest obligation to be paid
   * @param interestAccrued interest amount that can be paid before it's due
   * @param principalOwed principal obligation to be paid
   *
   * @return pa payment allocation
   *
   * @dev IO - Interest Owed
   * @dev PO - Principal Owed
   * @dev AI - Accrued Interest
   */
  function allocatePayment(
    uint256 principalPayment,
    uint256 interestPayment,
    uint256 balance,
    uint256 interestOwed,
    uint256 interestAccrued,
    uint256 principalOwed
  ) public pure returns (ITranchedPool.PaymentAllocation memory) {
    require(principalPayment > 0 || interestPayment > 0, "ZZ");
    // The payment waterfall works like this:

    // 1. Any interest that is _currently_ owed must be paid
    uint owedInterestPayment = Math.min(interestOwed, interestPayment);
    interestPayment = interestPayment.sub(owedInterestPayment);

    // 2. Any principal that is _currently_ owed must be paid
    // If you still owe interest then you can't pay back principal or pay down balance
    if (owedInterestPayment < interestOwed && principalPayment > 0) {
      revert("IO");
    }
    uint owedPrincipalPayment = Math.min(principalPayment, principalOwed);
    principalPayment = principalPayment.sub(owedPrincipalPayment);

    // 3. Any accured interest, meaning any interest that has accrued since the last payment
    //    date but isn't actually currently owed must be paid
    // If you still owe principal then you can't pay accrued interest
    if (owedPrincipalPayment < principalOwed && interestPayment > 0 && interestAccrued > 0) {
      revert("PO");
    }
    uint accruedInterestPayment = Math.min(interestPayment, interestAccrued);
    interestPayment = interestPayment.sub(accruedInterestPayment);

    // 4. If there's remaining principal payment, it can be applied to remaining balance
    // If you still have additional interest then you can't pay back balance
    if (
      accruedInterestPayment < interestAccrued &&
      principalPayment > 0 &&
      balance.sub(owedInterestPayment) > 0
    ) {
      revert("AI");
    }
    uint balanceRemaining = balance.sub(owedPrincipalPayment);
    uint additionalBalancePayment = Math.min(balanceRemaining, principalPayment);
    principalPayment = principalPayment.sub(additionalBalancePayment);

    // 5. Any remaining payment is not applied
    uint paymentRemaining = principalPayment.add(interestPayment);

    return
      ILoan.PaymentAllocation({
        owedInterestPayment: owedInterestPayment,
        accruedInterestPayment: accruedInterestPayment,
        principalPayment: owedPrincipalPayment,
        additionalBalancePayment: additionalBalancePayment,
        paymentRemaining: paymentRemaining
      });
  }
}

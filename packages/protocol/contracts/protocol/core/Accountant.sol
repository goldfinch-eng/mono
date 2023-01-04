// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ICreditLine} from "../../interfaces/ICreditLine.sol";
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

  /// @notice Payment allocation for a IV2CreditLine
  struct PaymentAllocation {
    uint256 interestPayment;
    uint256 principalPayment;
    uint256 additionalBalancePayment;
  }

  /// @notice Interest payment allocation for a separated payment on a ICreditLine
  struct InterestPaymentAllocation {
    uint256 owedInterestPayment;
    uint256 accruedInterestPayment;
    uint256 paymentRemaining;
  }

  /// @notice Principal payment allocation for a separated payment on a ICreditLine
  struct PrincipalPaymentAllocation {
    uint256 principalPayment;
    uint256 additionalBalancePayment;
    uint256 paymentRemaining;
  }

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

  /// @notice Allocate a payment for V1 Tranched Pools
  /// @param paymentAmount amount to allocate
  /// @param balance credit line's balance
  /// @param interestOwed interest owed on the credit line up to the last due time
  /// @param principalOwed principal owed ont he credit line
  /// @return PaymentAllocation payment allocation
  function allocatePayment(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 principalOwed
  ) public pure returns (PaymentAllocation memory) {
    uint256 paymentRemaining = paymentAmount;
    uint256 interestPayment = Math.min(interestOwed, paymentRemaining);
    paymentRemaining = paymentRemaining.sub(interestPayment);

    uint256 principalPayment = Math.min(principalOwed, paymentRemaining);
    paymentRemaining = paymentRemaining.sub(principalPayment);

    uint256 balanceRemaining = balance.sub(principalPayment);
    uint256 additionalBalancePayment = Math.min(paymentRemaining, balanceRemaining);

    return
      PaymentAllocation({
        interestPayment: interestPayment,
        principalPayment: principalPayment,
        additionalBalancePayment: additionalBalancePayment
      });
  }

  /// @notice Allocate a payment for v2 pools, which allow paying additional interest early
  /// @param paymentAmount amount to allocate
  /// @param balance credit line's balance
  /// @param interestOwed interest owed on the credit line up to the last due time
  /// @param interestAccrued interest accrued between the last due time and the present time (unless last due time
  ///   == termEndTime, in which case this param should be 0)
  /// @param principalOwed principal owed on the credit line
  /// @return PaymentAllocationV2 payment allocation
  function allocatePayment(
    uint256 paymentAmount,
    uint256 balance,
    uint256 interestOwed,
    uint256 interestAccrued,
    uint256 principalOwed
  ) public pure returns (ITranchedPool.PaymentAllocation memory) {
    uint256 paymentRemaining = paymentAmount;
    uint256 owedInterestPayment = Math.min(interestOwed, paymentRemaining);
    paymentRemaining = paymentRemaining.sub(owedInterestPayment);

    uint256 accruedInterestPayment = Math.min(interestAccrued, paymentRemaining);
    paymentRemaining = paymentRemaining.sub(accruedInterestPayment);

    uint256 principalPayment = Math.min(principalOwed, paymentRemaining);
    paymentRemaining = paymentRemaining.sub(principalPayment);

    uint256 balanceRemaining = balance.sub(principalPayment);
    uint256 additionalBalancePayment = Math.min(paymentRemaining, balanceRemaining);
    paymentRemaining = paymentRemaining.sub(additionalBalancePayment);

    return
      ITranchedPool.PaymentAllocation({
        owedInterestPayment: owedInterestPayment,
        accruedInterestPayment: accruedInterestPayment,
        principalPayment: principalPayment,
        additionalBalancePayment: additionalBalancePayment,
        paymentRemaining: paymentRemaining
      });
  }

  /// @notice Allocate an interest payment for a v2 separated payment.
  /// @param paymentAmount amount to be allocate
  /// @param interestOwed amount in interest owed
  /// @param interestAccrued amount of interest accrued in the current payment period (not yet owed)
  /// @return InterestPaymentAllocation the allocated interest payments
  function allocateInterestPayment(
    uint256 paymentAmount,
    uint256 interestOwed,
    uint256 interestAccrued
  ) public pure returns (InterestPaymentAllocation memory) {
    uint256 paymentRemaining = paymentAmount;
    uint256 owedInterestPayment = Math.min(paymentRemaining, interestOwed);
    paymentRemaining = paymentRemaining.sub(owedInterestPayment);

    uint256 accruedInterestPayment = Math.min(paymentRemaining, interestAccrued);
    paymentRemaining = paymentRemaining.sub(accruedInterestPayment);

    return
      InterestPaymentAllocation({
        owedInterestPayment: owedInterestPayment,
        accruedInterestPayment: accruedInterestPayment,
        paymentRemaining: paymentRemaining
      });
  }

  /// @notice Allocate a principal payment for a v2 separated payment.
  /// @param paymentAmount amount to be allocated
  /// @param balance outstanding balance on the credit line
  /// @param principalOwed principal owed on the credit line
  /// @return PrincipalPaymentAllocation the allocated principal and balance payments
  function allocatePrincipalPayment(
    uint256 paymentAmount,
    uint256 balance,
    uint256 principalOwed
  ) public pure returns (PrincipalPaymentAllocation memory) {
    uint256 paymentRemaining = paymentAmount;
    uint256 principalPayment = Math.min(paymentRemaining, principalOwed);
    paymentRemaining = paymentRemaining.sub(principalPayment);

    uint256 balanceRemaining = balance.sub(principalPayment);
    uint256 additionalBalancePayment = Math.min(paymentRemaining, balanceRemaining);
    paymentRemaining = paymentRemaining.sub(additionalBalancePayment);

    return
      PrincipalPaymentAllocation({
        principalPayment: principalPayment,
        additionalBalancePayment: additionalBalancePayment,
        paymentRemaining: paymentRemaining
      });
  }
}

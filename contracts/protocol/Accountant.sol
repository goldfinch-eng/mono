// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "./CreditLine.sol";
import "../external/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

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
  uint256 public constant FP_SCALING_FACTOR = 10**18;
  uint256 public constant INTEREST_DECIMALS = 1e8;
  uint256 public constant BLOCKS_PER_DAY = 5760;
  uint256 public constant BLOCKS_PER_YEAR = (BLOCKS_PER_DAY * 365);

  struct PaymentAllocation {
    uint256 interestPayment;
    uint256 principalPayment;
    uint256 additionalBalancePayment;
  }

  function calculateInterestAndPrincipalAccrued(
    CreditLine cl,
    uint256 blockNumber,
    uint256 lateFeeGracePeriod
  ) public view returns (uint256, uint256) {
    uint256 interestAccrued = calculateInterestAccrued(cl, blockNumber, lateFeeGracePeriod);
    uint256 principalAccrued = calculatePrincipalAccrued(cl, blockNumber);
    return (interestAccrued, principalAccrued);
  }

  function calculatePrincipalAccrued(CreditLine cl, uint256 blockNumber) public view returns (uint256) {
    if (blockNumber >= cl.termEndBlock()) {
      return cl.balance();
    } else {
      return 0;
    }
  }

  function calculateWritedownFor(
    CreditLine cl,
    uint256 blockNumber,
    uint256 gracePeriod,
    uint256 maxLatePeriods
  ) public view returns (uint256, uint256) {
    uint256 amountOwedLastPeriod = calculateAmountOwedForOnePeriod(cl);

    if (amountOwedLastPeriod == 0) {
      return (0, 0);
    }

    FixedPoint.Unsigned memory fpGracePeriod = FixedPoint.fromUnscaledUint(gracePeriod);
    FixedPoint.Unsigned memory periodsLate;

    // Excel math: =min(1,max(0,periods_late_in_days-graceperiod_in_days)/MAX_ALLOWED_DAYS_LATE) grace_period = 30,
    // Before the term end block, we use the interestOwed to calculate the periods late. However, after the loan term
    // has ended, since the interest is a much smaller fraction of the principal, we cannot reliably use interest to
    // calculate the periods later.
    if (blockNumber < cl.termEndBlock()) {
      uint256 totalOwed = cl.interestOwed().add(cl.principalOwed());
      periodsLate = FixedPoint.fromUnscaledUint(totalOwed).div(amountOwedLastPeriod);
    } else {
      uint256 blocksLate = blockNumber.sub(cl.termEndBlock());
      uint256 paymentPeriodInBlocks = cl.paymentPeriodInDays() * BLOCKS_PER_DAY;
      periodsLate = FixedPoint.fromUnscaledUint(blocksLate).div(paymentPeriodInBlocks);
    }

    FixedPoint.Unsigned memory maxLate = FixedPoint.fromUnscaledUint(maxLatePeriods);
    FixedPoint.Unsigned memory writedownPercent;

    if (periodsLate.isLessThanOrEqual(fpGracePeriod)) {
      // Within the grace period, we don't have to write down, so assume 0%
      writedownPercent = FixedPoint.fromUnscaledUint(0);
    } else {
      writedownPercent = FixedPoint.min(FixedPoint.fromUnscaledUint(1), (periodsLate.sub(fpGracePeriod)).div(maxLate));
    }

    FixedPoint.Unsigned memory writedownAmount = writedownPercent.mul(cl.balance()).div(FP_SCALING_FACTOR);
    // This will return a number between 0-100 representing the write down percent with no decimals
    uint256 unscaledWritedownPercent = writedownPercent.mul(100).div(FP_SCALING_FACTOR).rawValue;
    return (unscaledWritedownPercent, writedownAmount.rawValue);
  }

  function calculateAmountOwedForOnePeriod(CreditLine cl) public view returns (uint256) {
    // Determine theoretical interestOwed for one full period
    uint256 paymentPeriodInBlocks = cl.paymentPeriodInDays() * BLOCKS_PER_DAY;
    uint256 totalInterestPerYear = cl.balance().mul(cl.interestApr()).div(INTEREST_DECIMALS);
    uint256 interestOwed = totalInterestPerYear.mul(paymentPeriodInBlocks).div(BLOCKS_PER_YEAR);

    return interestOwed;
  }

  function calculateInterestAccrued(
    CreditLine cl,
    uint256 blockNumber,
    uint256 lateFeeGracePeriod
  ) public view returns (uint256) {
    // We use Math.min here to prevent integer overflow (ie. go negative) when calculating
    // numBlocksElapsed. Typically this shouldn't be possible, because
    // the interestAccruedAsOfBlock couldn't be *after* the current blockNumber. However, when assessing
    // we allow this function to be called with a past block number, which raises the possibility
    // of overflow.
    // This use of min should not generate incorrect interest calculations, since
    // this functions purpose is just to normalize balances, and  will be called any time
    // a balance affecting action takes place (eg. drawdown, repayment, assessment)
    uint256 interestAccruedAsOfBlock = Math.min(blockNumber, cl.interestAccruedAsOfBlock());

    uint256 numBlocksElapsed = blockNumber.sub(interestAccruedAsOfBlock);
    uint256 totalInterestPerYear = cl.balance().mul(cl.interestApr()).div(INTEREST_DECIMALS);
    uint256 interestOwed = totalInterestPerYear.mul(numBlocksElapsed).div(BLOCKS_PER_YEAR);

    if (lateFeeApplicable(cl, blockNumber, lateFeeGracePeriod)) {
      uint256 additionalLateFeeInterest = interestOwed.mul(cl.lateFeeApr()).div(INTEREST_DECIMALS);
      interestOwed = interestOwed.add(additionalLateFeeInterest);
    }

    return interestOwed;
  }

  function lateFeeApplicable(
    CreditLine cl,
    uint256 blockNumber,
    uint256 gracePeriod
  ) public view returns (bool) {
    uint256 blocksLate = blockNumber.sub(cl.lastFullPaymentBlock());
    uint256 gracePeriodInBlocks = gracePeriod.mul(cl.paymentPeriodInDays()).mul(BLOCKS_PER_DAY);
    return cl.lateFeeApr() > 0 && blocksLate > gracePeriodInBlocks;
  }

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
}

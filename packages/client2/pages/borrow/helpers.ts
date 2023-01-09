import { BigNumber } from "ethers";

import { FIDU_DECIMALS } from "@/constants";
import { roundUpToPrecision } from "@/lib/format";

/**
 * Calculates the current interest owed on the credit line.
 *
 * Assuming the borrower isn't late on any payments, interestOwed on the SC is 0 before the nextDueTime, and is dynamically calculated on FE.
 *
 * After crossing the nextDueTime any interest that accrued during that payment period becomes interest owed and interestOwed becomes non-zero on the SC.
 */
export function calculateInterestOwed({
  isLate,
  interestOwed,
  interestApr,
  nextDueTime,
  interestAccruedAsOf,
  balance,
}: {
  isLate: boolean;
  interestOwed: BigNumber;
  interestApr: BigNumber;
  nextDueTime: BigNumber;
  interestAccruedAsOf: BigNumber;
  balance: BigNumber;
}): BigNumber {
  if (isLate) {
    return interestOwed;
  }

  const expectedElapsedSeconds = nextDueTime.sub(interestAccruedAsOf);
  const secondsPerYear = BigNumber.from(60 * 60 * 24 * 365);
  const interestAccrualRate = interestApr.div(secondsPerYear);
  const expectedAdditionalInterest = balance
    .mul(interestAccrualRate)
    .mul(expectedElapsedSeconds);

  const currentInterestOwed = interestOwed
    .add(BigNumber.from(expectedAdditionalInterest))
    .div(BigNumber.from(String(1e18)));

  return currentInterestOwed;
}

/**
 * Calculates the amount owed for the current period
 *
 */
export function calculateNextDueAmount({
  currentInterestOwed,
  nextDueTime,
  termEndTime,
  balance,
}: {
  currentInterestOwed: BigNumber;
  nextDueTime: BigNumber;
  termEndTime: BigNumber;
  balance: BigNumber;
}): BigNumber {
  // If we are on our last period of the term, then it's interestOwed + principal
  // This is a bullet loan, so full principal is paid only at the end of the credit line term
  if (nextDueTime.gte(termEndTime)) {
    return currentInterestOwed.add(balance);
  } else {
    return currentInterestOwed;
  }
}

/**
 * Calculates the remaining amount owed for the period on the credit line, considering payments made so far.
 *
 */
export function calculateRemainingPeriodDueAmount({
  collectedPaymentBalance,
  nextDueTime,
  termEndTime,
  balance,
  currentInterestOwed,
}: {
  collectedPaymentBalance: BigNumber;
  nextDueTime: BigNumber;
  termEndTime: BigNumber;
  balance: BigNumber;
  currentInterestOwed: BigNumber;
}): BigNumber {
  const nextDueAmount = calculateNextDueAmount({
    currentInterestOwed,
    nextDueTime,
    termEndTime,
    balance,
  });

  // collectedPaymentBalance is the amount that's been paid so far for the period
  const remainingPeriodDueAmount = nextDueAmount.sub(collectedPaymentBalance);
  if (remainingPeriodDueAmount.lte(0)) {
    return BigNumber.from(0);
  }

  // We need to round up here to ensure the creditline is always fully paid,
  // this does mean the borrower may overpay by a penny max each time.
  return roundUpToPrecision(remainingPeriodDueAmount);
}

/**
 * Calculates the total remaining amount owed for the term on credit line, considering payments made so far.
 *
 */
export function calculateRemainingTotalDueAmount({
  collectedPaymentBalance,
  balance,
  currentInterestOwed,
}: {
  collectedPaymentBalance: BigNumber;
  balance: BigNumber;
  currentInterestOwed: BigNumber;
}): BigNumber {
  const totalDueAmount = currentInterestOwed.add(balance);

  const remainingTotalDueAmount = totalDueAmount.sub(collectedPaymentBalance);
  if (remainingTotalDueAmount.lte(0)) {
    return BigNumber.from(0);
  }

  // We need to round up here to ensure the creditline is always fully paid,
  // this does mean the borrower may overpay by a penny max each time.
  return roundUpToPrecision(remainingTotalDueAmount);
}

export enum CreditLineStatus {
  PaymentLate,
  PaymentDue,
  PeriodPaid,
  InActive,
}

export function getCreditLineStatus({
  isLate,
  remainingPeriodDueAmount,
  limit,
  remainingTotalDueAmount,
}: {
  isLate: boolean;
  remainingPeriodDueAmount: BigNumber;
  limit: BigNumber;
  remainingTotalDueAmount: BigNumber;
}) {
  // Is Late
  if (isLate) {
    return CreditLineStatus.PaymentLate;
  }

  // Payment is due - but not late
  if (remainingPeriodDueAmount.gt(0)) {
    return CreditLineStatus.PaymentDue;
  }

  // Credit line is active & paid
  if (limit.gt(0) && remainingTotalDueAmount.gt(0)) {
    return CreditLineStatus.PeriodPaid;
  }

  return CreditLineStatus.InActive;
}

/**
 * Calculates the available credit available for drawdown on a credit line
 *
 */
export function calculateAvailableCredit({
  collectedPaymentBalance,
  currentInterestOwed,
  nextDueTime,
  termEndTime,
  limit,
  balance,
}: {
  collectedPaymentBalance: BigNumber;
  currentInterestOwed: BigNumber;
  nextDueTime: BigNumber;
  termEndTime: BigNumber;
  limit: BigNumber;
  balance: BigNumber;
}): BigNumber {
  const periodDueAmount = calculateNextDueAmount({
    currentInterestOwed,
    nextDueTime,
    termEndTime,
    balance,
  });

  // The amount collected for principal is any amount contributed that exceeds the current period due amount
  let collectedForPrincipal = collectedPaymentBalance.sub(periodDueAmount);
  if (collectedForPrincipal.lt(BigNumber.from(0))) {
    collectedForPrincipal = BigNumber.from(0);
  }

  // Available credit is the lesser of the two:
  //  - The limit of the credit line (nothing borrowed yet or fully paid off)
  //  - The limit minus the outstanding principal balance, plus any amount collected for principal
  const availableCredit = limit.sub(balance).add(collectedForPrincipal);
  if (availableCredit.lt(limit)) {
    return availableCredit;
  }
  return limit;
}

// TODO Zadra reuse an existing fn for this?
export function trancheSharesToUsdc(
  numShares: BigNumber,
  sharePrice: BigNumber
): BigNumber {
  const fiduMantissa = BigNumber.from(10).pow(FIDU_DECIMALS);

  return numShares.mul(sharePrice).div(fiduMantissa);
}

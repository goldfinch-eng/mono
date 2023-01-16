import { BigNumber } from "ethers";

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
  // If we are on our last period of the term, then it's interestOwed + balance (balance is outstanding principal)
  // This is a bullet loan, so full balance is paid only at the end of the credit line term
  if (nextDueTime.gte(termEndTime)) {
    return currentInterestOwed.add(balance);
  }
  return currentInterestOwed;
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

  return remainingPeriodDueAmount;
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

  return remainingTotalDueAmount;
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
  // Is Late - unless the credit line is fully paid off, then is inactive
  if (isLate && remainingTotalDueAmount.gt(0)) {
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
 * A utility function for converting tranche shares from a tranched pool to a USDC amount
 */
const trancheSharesToUsdc = (
  principalDeposited: BigNumber, // USDC amount
  sharePrice: BigNumber
): BigNumber => {
  const sharePriceMantissa = BigNumber.from(10).pow(18);
  return principalDeposited.mul(sharePrice).div(sharePriceMantissa);
};

/**
 * Calculates the USDC amount available for drawdown on a credit line
 *
 *
 */
interface TrancheShareInfo {
  principalDeposited: BigNumber;
  sharePrice: BigNumber;
}
export function calculateAvailableForDrawdown({
  juniorTrancheShareInfo,
  seniorTrancheShareInfo,
}: {
  juniorTrancheShareInfo: TrancheShareInfo;
  seniorTrancheShareInfo: TrancheShareInfo;
}): BigNumber {
  /**
   * Calculates the amount available for drawdown from a tranched pool by converting the
   * total junior & senior shares to USDC.
   *
   * Why not use the CreditLine contract to calculate this?
   *
   * In the scenario a borrower pays off principal interest during the current period we can't rely on
   * CreditLine.balance() to determine the amount actually available for drawdown from the pool if an additional
   * drawdown is attempted during the same period.
   *
   * This is is b/c payments do not trigger a balance update on the Credit Line contract & CreditLine.assess()
   * only runs accounting updates once the current peroiod has passed.
   *
   * Payments do update the tranche share price(s), which can be used to calc avaible funds to drawdown from
   * the pool and represent the actual amount avaiable.
   *
   * i.e:
   * 1. Borrow full limit
   * 2. See borrow variable has been updated
   * 3. Pay off full interest + principal
   * 4. See borrow variable does not update to 0 (even when manually calling assess() b/c still in current period)
   */
  const juniorTrancheAmount = trancheSharesToUsdc(
    juniorTrancheShareInfo.principalDeposited,
    juniorTrancheShareInfo.sharePrice
  );
  const seniorTrancheAmount = trancheSharesToUsdc(
    seniorTrancheShareInfo.principalDeposited,
    seniorTrancheShareInfo.sharePrice
  );

  return juniorTrancheAmount.add(seniorTrancheAmount);
}

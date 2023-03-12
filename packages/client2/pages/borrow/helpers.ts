import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { roundUpUsdcPenny } from "@/lib/format";
import { LoanBorrowerAccountingFieldsFragment } from "@/lib/graphql/generated";

gql`
  fragment TranchedPoolBorrowerAccountingFields on TranchedPool {
    id
    nextDueTime
    interestAccruedAsOf
    interestOwed @client
    collectedPaymentBalance @client
    juniorTranches {
      id
      principalSharePrice
      principalDeposited
      lockedUntil
    }
    seniorTranches {
      id
      principalSharePrice
      principalDeposited
    }
  }
`;

gql`
  fragment CallableLoanBorrowerAccountingFields on CallableLoan {
    id
    totalDeposited
    totalPrincipalPaid
    paymentFrequency
    periodInterestDueAmount @client
    periodPrincipalDueAmount @client
    termTotalDueAmount @client
    nextDueTime @client
  }
`;

gql`
  fragment LoanBorrowerAccountingFields on Loan {
    __typename
    isPaused
    drawdownsPaused
    termInSeconds
    interestRate
    interestRateBigInt
    balance
    termEndTime
    principalAmount
    fundingLimit
    creditLineAddress
    isLate @client
    isAfterTermEndTime @client
    ...TranchedPoolBorrowerAccountingFields
    ...CallableLoanBorrowerAccountingFields
    borrowerContract {
      id
    }
  }
`;

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
  interestRateBigInt,
  nextDueTime,
  interestAccruedAsOf,
  balance,
}: {
  isLate: boolean;
  interestOwed: BigNumber;
  interestRateBigInt: BigNumber;
  nextDueTime: BigNumber;
  interestAccruedAsOf: BigNumber;
  balance: BigNumber;
}): BigNumber {
  if (isLate) {
    return roundUpUsdcPenny(interestOwed);
  }

  const expectedElapsedSeconds = nextDueTime.sub(interestAccruedAsOf);
  const secondsPerYear = BigNumber.from(60 * 60 * 24 * 365);
  const interestAccrualRate = interestRateBigInt.div(secondsPerYear);

  const interestRateBigIntMantissa = BigNumber.from(10).pow(18);
  const expectedAdditionalInterest = balance
    .mul(interestAccrualRate)
    .mul(expectedElapsedSeconds)
    .div(interestRateBigIntMantissa);

  return roundUpUsdcPenny(expectedAdditionalInterest.add(interestOwed));
}

/**
 * Calculates the amount owed for the current period
 *
 */
function calculateNextDueAmount({
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
function calculateRemainingPeriodDueAmount({
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
function calculateRemainingTotalDueAmount({
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
  Open,
  PaymentLate,
  PaymentDue,
  PeriodPaid,
  Repaid,
}

function getCreditLineStatus({
  isLate,
  remainingPeriodDueAmount,
  termEndTime,
  remainingTotalDueAmount,
}: {
  isLate: boolean;
  remainingPeriodDueAmount: BigNumber;
  termEndTime: BigNumber;
  remainingTotalDueAmount: BigNumber;
}) {
  // The credit line has not been drawndown yet
  if (termEndTime.eq(0)) {
    return CreditLineStatus.Open;
  }

  // Funds have been drawndown for the credit line
  if (remainingTotalDueAmount.gt(0)) {
    if (isLate) {
      return CreditLineStatus.PaymentLate;
    }

    if (remainingPeriodDueAmount.gt(0)) {
      return CreditLineStatus.PaymentDue;
    }

    return CreditLineStatus.PeriodPaid;
  }

  // The credit line's principal + interest has been fully repaid
  return CreditLineStatus.Repaid;
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
 * Calculates the USDC funds deposited in a tranched pool
 *
 */
interface TrancheShareInfo {
  principalDeposited: BigNumber;
  sharePrice: BigNumber;
}
export function calculatePoolFundsAvailable({
  juniorTrancheShareInfo,
  seniorTrancheShareInfo,
}: {
  juniorTrancheShareInfo: TrancheShareInfo;
  seniorTrancheShareInfo: TrancheShareInfo;
}): BigNumber {
  /**
   * Calculates the funds deposited in a tranched pool that could be drawdown by converting the
   * total junior & senior shares to USDC.
   *
   * Why not just use the CreditLine contract to calculate this?
   *
   * In the scenario a borrower pays off principal during the current period we can't rely on
   * CreditLine.balance() to determine the amount actually available for drawdown from the pool if an additional
   * drawdown is attempted during the same period.
   *
   * This is is b/c payments do not trigger a balance update on the Credit Line contract & CreditLine.assess()
   * only runs accounting updates once the current peroiod has passed.
   *
   * Payments do update the tranche share price(s), which can be used to calc avaiable funds to drawdown from
   * the pool and represent the actual amount avaiable.
   *
   * i.e:
   * 1. Borrow full limit
   * 2. See balance variable has been updated
   * 3. Pay off full interest + principal
   * 4. See balance variable does not update to 0 (even when manually calling assess() b/c still in current period)
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

/**
 * Calculates the max USDC amount that can be drawndown from a pool based on the state of the Credit Line
 *
 */
export function calculateCreditLineMaxDrawdownAmount({
  collectedPaymentBalance,
  currentInterestOwed,
  nextDueTime,
  termEndTime,
  principalAmount,
  balance,
}: {
  collectedPaymentBalance: BigNumber;
  currentInterestOwed: BigNumber;
  nextDueTime: BigNumber;
  termEndTime: BigNumber;
  principalAmount: BigNumber;
  balance: BigNumber;
}): BigNumber {
  const periodDueAmount = calculateNextDueAmount({
    currentInterestOwed,
    nextDueTime,
    termEndTime,
    balance,
  });

  let collectedForPrincipal = collectedPaymentBalance.sub(periodDueAmount);
  if (collectedForPrincipal.lt(BigNumber.from(0))) {
    collectedForPrincipal = BigNumber.from(0);
  }

  // Available credit is the lesser of the two:
  //  - The limit of the credit line (nothing borrowed yet or fully paid off)
  //  - The limit minus the outstanding principal balance, plus any amount collected for principal
  const availableCredit = principalAmount
    .sub(balance)
    .add(collectedForPrincipal);
  if (availableCredit.lt(principalAmount)) {
    return availableCredit;
  }

  return principalAmount;
}

/**
 * Analyses a Credit Line's Accounting fields to derive variables required for the borrower views
 *
 * @returns {Object} - an object containing the following fields:
 * @returns {BigNumber} [creditLineLimit] - the credit line's limit (could be current limit or max limit)
 * @returns {BigNumber} [currentInterestOwed] - the current interest owed on the Credit Line
 * @returns {BigNumber} [remainingPeriodDueAmount] - the remaining period due amount considering payments made so far
 * @returns {BigNumber} [remainingTotalDueAmount] - the remaining total due amount considering payments made so far
 * @returns {CreditLineStatus} [creditLineStatus] - the status of credit line
 */
export function getCreditLineAccountingAnalyisValues(
  loan: LoanBorrowerAccountingFieldsFragment
): {
  creditLineLimit: BigNumber;
  currentInterestOwed: BigNumber;
  remainingPeriodDueAmount: BigNumber;
  remainingTotalDueAmount: BigNumber;
  creditLineStatus: CreditLineStatus;
} {
  const {
    __typename,
    principalAmount,
    fundingLimit,
    isLate,
    interestRateBigInt,
    nextDueTime,
    balance,
    termEndTime,
  } = loan;

  // 'principalAmount' represents the limit once the pool has been locked.
  // Thus when still raising, we show the limit as the max funding limit of the pool
  const creditLineLimit = principalAmount.gt(0)
    ? principalAmount
    : fundingLimit;

  // TODO: Zadra figure out value for callableloan vs 0
  const currentInterestOwed =
    __typename === "CallableLoan"
      ? BigNumber.from(0)
      : calculateInterestOwed({
          isLate,
          interestOwed: loan.interestOwed,
          interestRateBigInt,
          nextDueTime,
          interestAccruedAsOf: loan.interestAccruedAsOf,
          balance,
        });

  const remainingPeriodDueAmount =
    __typename === "CallableLoan"
      ? loan.periodInterestDueAmount.add(loan.periodPrincipalDueAmount)
      : calculateRemainingPeriodDueAmount({
          collectedPaymentBalance: loan.collectedPaymentBalance,
          nextDueTime,
          termEndTime,
          balance,
          currentInterestOwed,
        });

  const remainingTotalDueAmount =
    __typename === "CallableLoan"
      ? loan.termTotalDueAmount
      : calculateRemainingTotalDueAmount({
          collectedPaymentBalance: loan.collectedPaymentBalance,
          balance,
          currentInterestOwed,
        });

  const creditLineStatus = getCreditLineStatus({
    isLate,
    remainingPeriodDueAmount,
    termEndTime,
    remainingTotalDueAmount,
  });

  return {
    creditLineLimit,
    currentInterestOwed,
    remainingPeriodDueAmount,
    remainingTotalDueAmount,
    creditLineStatus,
  };
}

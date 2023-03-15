/* eslint-disable no-console */
import { Resolvers } from "@apollo/client";
import { addDays, endOfDay, fromUnixTime, getUnixTime } from "date-fns";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers";

import { BORROWER_METADATA, POOL_METADATA } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { assertUnreachable } from "@/lib/utils";
import { getFreshProvider, getProvider } from "@/lib/wallet";

import { CallableLoan, LoanDelinquency } from "../generated";

export enum LoanPhase {
  Prefunding = "Prefunding",
  Funding = "Funding",
  DrawdownPeriod = "DrawdownPeriod",
  InProgress = "InProgress",
}

/**
 * Returns the Unix timestamp for the end of the next day after given timestamp.
 *
 */
const getEndOfNextDayTimestamp = (currentTimestamp: number): number => {
  const nextDay = addDays(fromUnixTime(currentTimestamp), 1);
  const endOfNextDay = endOfDay(nextDay);

  return getUnixTime(endOfNextDay);
};

const getLoanPeriodDueAmount = async (callableLoanId: string) => {
  const provider = await getProvider();
  const callableLoanContract = await getContract({
    name: "CallableLoan",
    provider,
    useSigner: false,
    address: callableLoanId,
  });

  // Loan has not started
  const termEndTime = await callableLoanContract.termEndTime();
  if (termEndTime.eq(0)) {
    return {
      interestOwed: BigNumber.from(0),
      principalOwed: BigNumber.from(0),
    };
  }

  const isLate = await callableLoanContract.isLate();

  // Scenario 1: We are EARLY - the borrower will pre-pay interest + principal that would be due at the end of the month
  if (!isLate) {
    const nextDueTime = await callableLoanContract.nextDueTime();
    const [interestOwed, principalOwed] = await Promise.all([
      callableLoanContract.interestOwedAt(nextDueTime),
      callableLoanContract.principalOwedAt(nextDueTime),
    ]);

    return {
      interestOwed,
      principalOwed,
    };
  }

  // TODO: Zadra remove - using for local testing
  const uncachedProvider = getFreshProvider();
  const { timestamp: currentTimestamp } = await uncachedProvider.getBlock(
    "latest"
  );
  const isPastTermEndTime = currentTimestamp > termEndTime.toNumber();
  // Scenario 2: We are LATE and BEFORE termEndTime - the borrower owes interest + principal from the periods they missed
  if (!isPastTermEndTime) {
    const [interestOwed, principalOwed] = await Promise.all([
      callableLoanContract.interestOwed(),
      callableLoanContract.principalOwed(),
    ]);

    return {
      interestOwed,
      principalOwed,
    };
  }

  // Scenario 3: We are LATE and AFTER termEndTime - the borrower owes interest + principal from the periods they missed AND the interest that is actively accuring per second
  // Note: We add a buffer of the end of the next day to the calculated interest owed since interest is accrued per second
  const endOfNextDayTimestamp = getEndOfNextDayTimestamp(currentTimestamp);
  const [interestOwed, principalOwed] = await Promise.all([
    // "interestOwedAt" will consider accruing interest when we're past "termEndTime"
    callableLoanContract.interestOwedAt(endOfNextDayTimestamp),
    callableLoanContract.principalOwedAt(endOfNextDayTimestamp),
  ]);

  console.log({
    endOfNextDayTimestamp,
    interestOwed: formatCrypto({ amount: interestOwed, token: "USDC" }),
    principalOwed: formatCrypto({ amount: principalOwed, token: "USDC" }),
  });

  return {
    interestOwed,
    principalOwed,
  };
};

const getLoanTermDueAmount = async (callableLoanId: string) => {
  // TODO: Zadra remove - using for local testing
  const uncachedProvider = getFreshProvider();
  const callableLoanContract = await getContract({
    name: "CallableLoan",
    provider: uncachedProvider,
    useSigner: false,
    address: callableLoanId,
  });

  // Loan has not started
  const termEndTime = await callableLoanContract.termEndTime();
  if (termEndTime.eq(0)) {
    return BigNumber.from(0);
  }

  const { timestamp: currentTimestamp } = await uncachedProvider.getBlock(
    "latest"
  );
  const currentNextDueTime = await callableLoanContract.nextDueTimeAt(
    currentTimestamp
  );
  const isLastPeriod = currentNextDueTime.toNumber() === termEndTime.toNumber();

  // If we're NOT on the last period, then the total amount owed for the loan is the sum of:
  // - The total outstanding principal owed on the loan
  // - The total outstanding interest owed on the loan
  // - The total interest owed up to the next period due time (for callable loans only - not BPI)
  if (!isLastPeriod) {
    const nextPrincipalDueTime =
      await callableLoanContract.nextPrincipalDueTime();

    const [interestOwed, principalOwed] = await Promise.all([
      callableLoanContract.interestOwedAt(nextPrincipalDueTime),
      callableLoanContract.principalOwedAt(termEndTime),
    ]);

    console.log({
      isLastPeriod,
      nextPrincipalDueTime: formatDate(
        nextPrincipalDueTime.toNumber() * 1000,
        "MMM d"
      ),
      interestOwed: formatCrypto({ amount: interestOwed, token: "USDC" }),
      principalOwed: formatCrypto({ amount: principalOwed, token: "USDC" }),
    });

    return interestOwed.add(principalOwed);
  }

  // If we're on the last period, then the total amount owed for the loan is simply the period due amount
  const { interestOwed, principalOwed } = await getLoanPeriodDueAmount(
    callableLoanId
  );

  console.log({
    isLastPeriod,
    interestOwed: formatCrypto({ amount: interestOwed, token: "USDC" }),
    principalOwed: formatCrypto({ amount: principalOwed, token: "USDC" }),
  });

  return interestOwed.add(principalOwed);
};

export const callableLoanResolvers: Resolvers[string] = {
  name(callableLoan: CallableLoan) {
    return (
      POOL_METADATA[callableLoan.id as keyof typeof POOL_METADATA]?.name ??
      `Pool ${callableLoan.id}`
    );
  },
  borrowerName(callableLoan: CallableLoan) {
    const borrowerId =
      POOL_METADATA[callableLoan.id as keyof typeof POOL_METADATA]?.borrower;
    if (borrowerId) {
      const borrower =
        BORROWER_METADATA[borrowerId as keyof typeof BORROWER_METADATA];
      if (borrower) {
        return borrower.name;
      }
    }
    return "Borrower";
  },
  borrowerLogo(callableLoan: CallableLoan) {
    const borrowerId =
      POOL_METADATA[callableLoan.id as keyof typeof POOL_METADATA]?.borrower;
    if (borrowerId) {
      const borrower =
        BORROWER_METADATA[borrowerId as keyof typeof BORROWER_METADATA];
      if (borrower) {
        return borrower.logo;
      }
    }
    return null;
  },
  async delinquency(callableLoan: CallableLoan): Promise<LoanDelinquency> {
    const secondsPerDay = 60 * 60 * 24;
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "TranchedPool",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });
    const goldfinchConfigContract = await getContract({
      name: "GoldfinchConfig",
      address: await callableLoanContract.config(),
      provider,
      useSigner: false,
    });
    const creditLineContract = await getContract({
      name: "CreditLine",
      address: await callableLoanContract.creditLine(),
      provider,
    });
    const [currentBlock, gracePeriodInDays, lastFullPaymentTime, isLate] =
      await Promise.all([
        provider.getBlock("latest"),
        goldfinchConfigContract.getNumber(5),
        creditLineContract.lastFullPaymentTime(),
        creditLineContract.isLate(),
      ]);
    const gracePeriodInSeconds = gracePeriodInDays.toNumber() * secondsPerDay;
    const oldestUnpaidDueTime = await creditLineContract.nextDueTimeAt(
      lastFullPaymentTime
    );
    if (!isLate) {
      return "CURRENT";
    } else if (
      currentBlock.timestamp <
      oldestUnpaidDueTime.toNumber() + gracePeriodInSeconds
    ) {
      return "GRACE_PERIOD";
    } else {
      return "LATE";
    }
  },
  async inLockupPeriod(callableLoan: CallableLoan): Promise<boolean> {
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });
    try {
      const inLockupPeriod = await callableLoanContract.inLockupPeriod();
      return inLockupPeriod;
    } catch (e) {
      return false;
    }
  },
  async nextPrincipalDueTime(callableLoan: CallableLoan): Promise<number> {
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });
    try {
      // This will throw on loans that are not closed
      const nextPrincipalDueTime =
        await callableLoanContract.nextPrincipalDueTime();
      return nextPrincipalDueTime.toNumber();
    } catch (e) {
      return 0;
    }
  },
  async isAfterTermEndTime(callableLoan: CallableLoan): Promise<boolean> {
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });

    const [currentBlock, termEndTime] = await Promise.all([
      provider.getBlock("latest"),
      callableLoanContract.termEndTime(),
    ]);

    return termEndTime.gt(0) && currentBlock.timestamp > termEndTime.toNumber();
  },
  async periodInterestDueAmount(
    callableLoan: CallableLoan
  ): Promise<BigNumber> {
    const { interestOwed } = await getLoanPeriodDueAmount(callableLoan.id);
    return interestOwed;
  },
  async periodPrincipalDueAmount(
    callableLoan: CallableLoan
  ): Promise<BigNumber> {
    const { principalOwed } = await getLoanPeriodDueAmount(callableLoan.id);
    return principalOwed;
  },
  async termTotalDueAmount(callableLoan: CallableLoan): Promise<BigNumber> {
    return getLoanTermDueAmount(callableLoan.id);
  },
  async nextDueTime(callableLoan: CallableLoan): Promise<BigNumber> {
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });

    const lastFullPaymentTime =
      await callableLoanContract.lastFullPaymentTime();
    return callableLoanContract.nextDueTimeAt(lastFullPaymentTime);
  },
  async loanPhase(callableLoan: CallableLoan): Promise<LoanPhase> {
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });

    const loanPhase = await callableLoanContract.loanPhase();

    switch (loanPhase) {
      case 0:
        return LoanPhase.Prefunding;
      case 1:
        return LoanPhase.Funding;
      case 2:
        return LoanPhase.DrawdownPeriod;
      case 3:
        return LoanPhase.InProgress;
      default:
        return assertUnreachable(loanPhase as never);
    }
  },
};

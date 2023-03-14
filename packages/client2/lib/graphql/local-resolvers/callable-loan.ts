import { Resolvers } from "@apollo/client";

import { BORROWER_METADATA, POOL_METADATA } from "@/constants";
import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { CallableLoan, LoanDelinquency } from "../generated";

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
};

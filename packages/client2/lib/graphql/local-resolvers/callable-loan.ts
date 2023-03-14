import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { BORROWER_METADATA, POOL_METADATA } from "@/constants";
import { getContract } from "@/lib/contracts";
import { roundUpUsdcPenny } from "@/lib/format";
import { assertUnreachable } from "@/lib/utils";
import { getProvider } from "@/lib/wallet";

import { CallableLoan } from "../generated";

export enum LoanPhase {
  Prefunding = "Prefunding",
  Funding = "Funding",
  DrawdownPeriod = "DrawdownPeriod",
  InProgress = "InProgress",
}

const loanDueAmount = async (callableLoanId: string) => {
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
  if (isLate) {
    // Should a user be paying the interest accrued over the current period when they're late?
    // Or should they just be paying the interest + principal they would have owed for the periods they missed?
    const [interestOwed, principalOwed] = await Promise.all([
      callableLoanContract.interestOwed(),
      callableLoanContract.principalOwed(),
    ]);

    return {
      // STILL getting dust issues on atomic amounts of USDC even when value comes from smart contract
      interestOwed: interestOwed.isZero()
        ? interestOwed
        : roundUpUsdcPenny(interestOwed),
      principalOwed,
    };
  }

  const lastFullPaymentTime = await callableLoanContract.lastFullPaymentTime();
  const owedAtTimestamp = await callableLoanContract.nextDueTimeAt(
    lastFullPaymentTime
  );
  const [interestOwed, principalOwed] = await Promise.all([
    callableLoanContract.interestOwedAt(owedAtTimestamp),
    callableLoanContract.principalOwedAt(owedAtTimestamp),
  ]);

  return {
    interestOwed: interestOwed.isZero()
      ? interestOwed
      : roundUpUsdcPenny(interestOwed),
    principalOwed,
  };
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
  async isLate(callableLoan: CallableLoan): Promise<boolean> {
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });

    return callableLoanContract.isLate();
  },
  async isInDefault(callableLoan: CallableLoan): Promise<boolean> {
    const provider = await getProvider();
    const callableLoanContract = await getContract({
      name: "CallableLoan",
      provider,
      useSigner: false,
      address: callableLoan.id,
    });
    const termStartTime = await callableLoanContract.termStartTime();
    const withinPrincipalGracePeriod =
      await callableLoanContract.withinPrincipalGracePeriod();
    return !termStartTime.isZero() && !withinPrincipalGracePeriod;
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
    const { interestOwed } = await loanDueAmount(callableLoan.id);
    return interestOwed;
  },
  async periodPrincipalDueAmount(
    callableLoan: CallableLoan
  ): Promise<BigNumber> {
    const { principalOwed } = await loanDueAmount(callableLoan.id);
    return principalOwed;
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

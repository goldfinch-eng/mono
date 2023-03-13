import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { BORROWER_METADATA, POOL_METADATA } from "@/constants";
import { getContract } from "@/lib/contracts";
import { formatCrypto } from "@/lib/format";
import { getProvider } from "@/lib/wallet";

import { CallableLoan } from "../generated";

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
    const [interestOwed, interestAccrued, principalOwed] = await Promise.all([
      callableLoanContract.interestOwed(),
      callableLoanContract.interestAccrued(),
      callableLoanContract.principalOwed(),
    ]);

    // eslint-disable-next-line no-console
    console.log({
      interestOwed: formatCrypto({ amount: interestOwed, token: "USDC" }),
      interestAccrued: formatCrypto({ amount: interestAccrued, token: "USDC" }),
      principalOwed: formatCrypto({ amount: principalOwed, token: "USDC" }),
    });

    return {
      interestOwed: interestOwed
        .add(interestAccrued)
        // TODO: Zadra Add 24 hr interest accrual since it accrues every second
        .add(BigNumber.from(100000)),
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

  // eslint-disable-next-line no-console
  console.log({
    interestOwed: formatCrypto({ amount: interestOwed, token: "USDC" }),
    principalOwed: formatCrypto({ amount: principalOwed, token: "USDC" }),
    owedAtTimestamp: owedAtTimestamp.toNumber(),
  });

  return {
    interestOwed,
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
};

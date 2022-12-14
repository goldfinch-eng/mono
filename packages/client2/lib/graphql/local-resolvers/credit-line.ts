import { Resolvers } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { APY_DECIMALS, SECONDS_PER_YEAR, SECONDS_PER_DAY } from "@/constants";
import { getContract } from "@/lib/contracts";
import { roundUpPenny } from "@/lib/format";
import { CreditLine } from "@/lib/graphql/generated";
import { getProvider } from "@/lib/wallet";

async function isCreditLinePaymentLate(
  creditLine: CreditLine
): Promise<boolean> {
  // Not all CreditLine contracts have an 'isLate' accessor - use block timestamp to calc
  const provider = await getProvider();

  const currentBlock = await provider.getBlock("latest");
  if (creditLine.lastFullPaymentTime.isZero()) {
    // Brand new creditline
    return false;
  }

  const secondsSinceLastFullPayment =
    currentBlock.timestamp - creditLine.lastFullPaymentTime.toNumber();

  return (
    secondsSinceLastFullPayment >
    creditLine.paymentPeriodInDays.toNumber() * SECONDS_PER_DAY
  );
}

async function calculateInterestOwed(
  creditLine: CreditLine
): Promise<BigNumber> {
  const provider = await getProvider();

  // It seems like The Graph is not properly updating CreditLine.interestOwed - fetch from contract
  const creditLineContract = await getContract({
    name: "CreditLine",
    address: creditLine.id,
    provider,
    useSigner: false,
  });
  const isLate = await isCreditLinePaymentLate(creditLine);

  const interestOwed = await creditLineContract.interestOwed();

  if (isLate) {
    return interestOwed;
  }

  const annualRate = creditLine.interestAprDecimal;
  const expectedElapsedSeconds = creditLine.nextDueTime.sub(
    creditLine.interestAccruedAsOf
  );
  const interestAccrualRate = annualRate.divUnsafe(
    FixedNumber.from(SECONDS_PER_YEAR)
  );
  const expectedAdditionalInterest = FixedNumber.from(creditLine.balance)
    .mulUnsafe(interestAccrualRate)
    .mulUnsafe(FixedNumber.from(expectedElapsedSeconds));

  const currentInterestOwed = interestOwed
    .add(BigNumber.from(expectedAdditionalInterest))
    .div(APY_DECIMALS);

  return currentInterestOwed;
}

export const creditLineResolvers: Resolvers[string] = {
  async isLate(creditLine: CreditLine): Promise<boolean> {
    return await isCreditLinePaymentLate(creditLine);
  },

  // The remaining amount owed for the period
  async remainingPeriodDueAmount(creditLine: CreditLine): Promise<BigNumber> {
    const provider = await getProvider();
    const usdcContract = await getContract({ name: "USDC", provider });
    const collectedPaymentBalance = await usdcContract.balanceOf(creditLine.id);

    const currentInterestOwed = await calculateInterestOwed(creditLine);

    // If we are on our last period of the term, then it's interestOwed + principal
    // This is a bullet loan, so full principal is paid only at the end of the credit line term
    if (creditLine.nextDueTime.gte(creditLine.termEndTime)) {
      return currentInterestOwed.add(creditLine.balance);
    }

    // collectedPaymentBalance is the amount that's been paid so far for the period
    const remainingPeriodDueAmount = currentInterestOwed.sub(
      collectedPaymentBalance
    );
    if (remainingPeriodDueAmount.lte(0)) {
      return BigNumber.from(0);
    }

    // We need to round up here to ensure the creditline is always fully paid,
    // this does mean the borrower may overpay by a penny max each time.
    return roundUpPenny(remainingPeriodDueAmount);
  },

  // The total remaining amount owed for the loan term
  async remainingTotalDueAmount(creditLine: CreditLine): Promise<BigNumber> {
    const provider = await getProvider();
    const usdcContract = await getContract({ name: "USDC", provider });
    const collectedPaymentBalance = await usdcContract.balanceOf(creditLine.id);

    const currentInterestOwed = await calculateInterestOwed(creditLine);
    const totalDueAmount = currentInterestOwed.add(creditLine.balance);

    const remainingTotalDueAmount = totalDueAmount.sub(collectedPaymentBalance);
    if (remainingTotalDueAmount.lte(0)) {
      return BigNumber.from(0);
    }

    // We need to round up here to ensure the creditline is always fully paid,
    // this does mean the borrower may overpay by a penny max each time.
    return roundUpPenny(remainingTotalDueAmount);
  },
};

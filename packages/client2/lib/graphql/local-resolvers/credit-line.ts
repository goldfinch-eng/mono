import { Resolvers } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { APY_DECIMALS, SECONDS_PER_YEAR, SECONDS_PER_DAY } from "@/constants";
import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { CreditLine, TranchedPoolCreditLineVersion } from "../generated";

export const creditLineResolvers: Resolvers[string] = {
  // Not all CreditLine contracts have an 'isLate' accessor - use block timestamp to calc
  async isLate(creditLine: CreditLine): Promise<boolean> {
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
  },
  currentLimit(creditLine: CreditLine): BigNumber {
    // TODO ZADRA - check limit vars with solidity dev
    // if (creditLine.limit.gt(0)) {
    //   return creditLine.limit;
    // } else {
    // maxLimit is not available on older versions of the creditline, so fall back to limit in that case
    const maxLimit =
      creditLine.version === TranchedPoolCreditLineVersion.V2_2
        ? creditLine.maxLimit
        : creditLine.limit;

    return maxLimit;
    // }
  },
  currentInterestOwed(creditLine: CreditLine): BigNumber {
    // TODO ZADRA - this is code from client1, wouldn't this be the case if !isLate...?
    if (creditLine.isLate) {
      return creditLine.interestOwed;
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

    const currentInterestOwed = creditLine.interestOwed
      .add(BigNumber.from(expectedAdditionalInterest))
      .div(APY_DECIMALS);

    return currentInterestOwed;
  },
  nextDueAmount(creditLine: CreditLine): BigNumber {
    const interestOwed = creditLineResolvers.currentInterestOwed(
      creditLine
    ) as BigNumber;
    const balance = creditLine.balance;

    // If the next repayment date exceeds the end of the term, the amount due is the remaining balance + interest owed
    if (creditLine.nextDueTime.gte(creditLine.termEndTime)) {
      return interestOwed.add(balance);
    } else {
      return interestOwed;
    }
  },
  async remainingPeriodDueAmount(creditLine: CreditLine): Promise<BigNumber> {
    const provider = await getProvider();

    const usdcContract = await getContract({ name: "USDC", provider });
    const collectedPaymentBalance = await usdcContract.balanceOf(creditLine.id);

    const periodDueAmount = creditLineResolvers.nextDueAmount(
      creditLine
    ) as BigNumber;

    const remainingPeriodDueAmount = periodDueAmount.sub(
      collectedPaymentBalance
    );
    if (remainingPeriodDueAmount.lte(0)) {
      return BigNumber.from(0);
    }

    return remainingPeriodDueAmount;
  },
  async remainingTotalDueAmount(creditLine: CreditLine): Promise<BigNumber> {
    const provider = await getProvider();

    const usdcContract = await getContract({ name: "USDC", provider });
    const collectedPaymentBalance = await usdcContract.balanceOf(creditLine.id);

    const interestOwed = creditLineResolvers.currentInterestOwed(
      creditLine
    ) as BigNumber;

    const balance = creditLine.balance;
    const totalDueAmount = interestOwed.add(balance);

    const remainingTotalDueAmount = totalDueAmount.sub(collectedPaymentBalance);
    if (remainingTotalDueAmount.lte(0)) {
      return BigNumber.from(0);
    }

    return remainingTotalDueAmount;
  },
  // Has an open balance
  async isActive(creditLine: CreditLine): Promise<boolean> {
    const remainingTotalDueAmount =
      (await creditLineResolvers.remainingTotalDueAmount(
        creditLine
      )) as BigNumber;

    // TODO ZADRA - must use correct limit here
    return creditLine.limit.gt(0) && remainingTotalDueAmount.gt(0);
  },
};

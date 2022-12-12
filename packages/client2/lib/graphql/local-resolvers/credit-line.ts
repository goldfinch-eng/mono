import { Resolvers } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { APY_DECIMALS, SECONDS_PER_YEAR } from "@/constants";
import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { CreditLine, TranchedPoolCreditLineVersion } from "../generated";

export const creditLineResolvers: Resolvers[string] = {
  async isLate(creditLine: CreditLine): Promise<boolean | null> {
    const provider = await getProvider();
    if (!creditLine.id) {
      throw new Error("CreditLine ID unavailable when querying isLate");
    }
    const creditLineContract = await getContract({
      name: "CreditLine",
      address: creditLine.id,
      provider,
      useSigner: false,
    });
    try {
      return await creditLineContract.isLate();
    } catch (e) {
      return null;
    }
  },
  currentLimit(creditLine: CreditLine): BigNumber {
    // maxLimit is not available on older versions of the creditline, so fall back to limit in that case
    return creditLine.version === TranchedPoolCreditLineVersion.V2_2
      ? creditLine.maxLimit
      : creditLine.limit;
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

    // nextDueAmount
    if (creditLine.nextDueTime.gte(creditLine.termEndTime)) {
      return currentInterestOwed.add(creditLine.balance);
    } else {
      return currentInterestOwed;
    }
  },
  async collectedPaymentBalance(
    creditLine: CreditLine
  ): Promise<BigNumber | null> {
    const provider = await getProvider();
    if (!creditLine.id) {
      throw new Error(
        "CreditLine ID unavailable when querying collectedPaymentBalance"
      );
    }
    try {
      const usdcContract = await getContract({ name: "USDC", provider });
      return await usdcContract.balanceOf(creditLine.id);
    } catch (e) {
      return null;
    }
  },
};

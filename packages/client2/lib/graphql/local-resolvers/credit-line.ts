import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { CreditLine } from "@/lib/graphql/generated";
import { getProvider } from "@/lib/wallet";

export const creditLineResolvers: Resolvers[string] = {
  async isLate(creditLine: CreditLine): Promise<boolean> {
    const provider = await getProvider();

    const creditLineContract = await getContract({
      name: "CreditLine",
      address: creditLine.id,
      provider,
      useSigner: false,
    });

    try {
      return await creditLineContract.isLate();
    } catch (e) {
      // Not all CreditLine contracts have an 'isLate' accessor - use block timestamp to calc
      const [currentBlock, lastFullPaymentTime, paymentPeriodInDays] =
        await Promise.all([
          provider.getBlock("latest"),
          creditLineContract.lastFullPaymentTime(),
          creditLineContract.paymentPeriodInDays(),
        ]);

      if (lastFullPaymentTime.isZero()) {
        // Brand new creditline
        return false;
      }

      const secondsSinceLastFullPayment =
        currentBlock.timestamp - lastFullPaymentTime.toNumber();

      const secondsPerDay = 60 * 60 * 24;

      return (
        secondsSinceLastFullPayment >
        paymentPeriodInDays.toNumber() * secondsPerDay
      );
    }
  },
  async collectedPaymentBalance(creditLine: CreditLine): Promise<BigNumber> {
    const provider = await getProvider();
    const usdcContract = await getContract({ name: "USDC", provider });
    const collectedPaymentBalance = await usdcContract.balanceOf(creditLine.id);

    return collectedPaymentBalance;
  },
  async isAfterTermEndTime(creditLine: CreditLine): Promise<boolean> {
    const provider = await getProvider();
    const creditLineContract = await getContract({
      name: "CreditLine",
      address: creditLine.id,
      provider,
      useSigner: false,
    });

    const [currentBlock, termEndTime] = await Promise.all([
      provider.getBlock("latest"),
      creditLineContract.termEndTime(),
    ]);

    return termEndTime.gt(0) && currentBlock.timestamp > termEndTime.toNumber();
  },
};

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

    let isLate = false;
    try {
      isLate = await creditLineContract.isLate();
    } catch (e) {
      // Not all CreditLine contracts have an 'isLate' accessor - use block timestamp to calc
      const currentBlock = await provider.getBlock("latest");
      const lastFullPaymentTime =
        await creditLineContract.lastFullPaymentTime();
      const paymentPeriodInDays =
        await creditLineContract.paymentPeriodInDays();

      if (lastFullPaymentTime.isZero()) {
        // Brand new creditline
        return false;
      }

      const secondsSinceLastFullPayment =
        currentBlock.timestamp - lastFullPaymentTime.toNumber();

      const secondsPerDay = 60 * 60 * 24;

      isLate =
        secondsSinceLastFullPayment >
        paymentPeriodInDays.toNumber() * secondsPerDay;
    }

    return isLate;
  },
  async collectedPaymentBalance(creditLine: CreditLine): Promise<BigNumber> {
    const provider = await getProvider();
    const usdcContract = await getContract({ name: "USDC", provider });
    const collectedPaymentBalance = await usdcContract.balanceOf(creditLine.id);

    return collectedPaymentBalance;
  },
};

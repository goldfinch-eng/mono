import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { CreditLine } from "@/lib/graphql/generated";
import { getProvider } from "@/lib/wallet";

export async function isLate(creditLineAddress: string): Promise<boolean> {
  const provider = await getProvider();

  const creditLineContract = await getContract({
    name: "CreditLine",
    address: creditLineAddress,
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
}

export async function isInDefault(creditLineAddress: string): Promise<boolean> {
  const provider = await getProvider();

  const creditLineContract = await getContract({
    name: "CreditLine",
    address: creditLineAddress,
    provider,
    useSigner: false,
  });

  try {
    const termStartTime = await creditLineContract.termStartTime();
    // Newer credit lines have this function than can be used to immediately determine if principal is in default
    const withinPrincipalGracePeriod =
      await creditLineContract.withinPrincipalGracePeriod();
    return !termStartTime.isZero() && !withinPrincipalGracePeriod;
  } catch (e) {
    // Do nothing, move on
  }

  const goldfinchConfigContract = await getContract({
    name: "GoldfinchConfig",
    address: await creditLineContract.config(),
    provider,
    useSigner: false,
  });

  const [
    currentBlock,
    lastFullPaymentTime,
    paymentPeriodInDays,
    latenessGracePeriodInDays,
  ] = await Promise.all([
    provider.getBlock("latest"),
    creditLineContract.lastFullPaymentTime(),
    creditLineContract.paymentPeriodInDays(),
    goldfinchConfigContract.getNumber(5),
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
    (paymentPeriodInDays.toNumber() + latenessGracePeriodInDays.toNumber()) *
      secondsPerDay
  );
}

export const creditLineResolvers: Resolvers[string] = {
  async isLate(creditLine: CreditLine): Promise<boolean> {
    return isLate(creditLine.id);
  },
  async isInDefault(creditLine: CreditLine): Promise<boolean> {
    return isInDefault(creditLine.id);
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
  async interestOwed(creditLine: CreditLine): Promise<BigNumber> {
    const provider = await getProvider();
    const creditLineContract = await getContract({
      name: "CreditLine",
      address: creditLine.id,
      provider,
      useSigner: false,
    });

    return creditLineContract.interestOwed();
  },
};

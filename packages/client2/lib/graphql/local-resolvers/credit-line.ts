import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { CreditLine } from "@/lib/graphql/generated";
import { getProvider } from "@/lib/wallet";

export async function interestOwed(
  creditLineAddress: string
): Promise<BigNumber> {
  const provider = await getProvider();
  const creditLineContract = await getContract({
    name: "CreditLine",
    address: creditLineAddress,
    provider,
    useSigner: false,
  });

  return await creditLineContract.interestOwed();
}

export async function isAfterTermEndTime(
  creditLineAddress: string
): Promise<boolean> {
  const provider = await getProvider();
  const creditLineContract = await getContract({
    name: "CreditLine",
    address: creditLineAddress,
    provider,
    useSigner: false,
  });

  const [currentBlock, termEndTime] = await Promise.all([
    provider.getBlock("latest"),
    creditLineContract.termEndTime(),
  ]);

  return termEndTime.gt(0) && currentBlock.timestamp > termEndTime.toNumber();
}

export async function collectedPaymentBalance(
  creditLineAddress: string
): Promise<BigNumber> {
  const provider = await getProvider();
  const usdcContract = await getContract({ name: "USDC", provider });
  const collectedPaymentBalance = await usdcContract.balanceOf(
    creditLineAddress
  );

  return collectedPaymentBalance;
}

export const creditLineResolvers: Resolvers[string] = {
  async collectedPaymentBalance(creditLine: CreditLine): Promise<BigNumber> {
    return collectedPaymentBalance(creditLine.id);
  },
  async isAfterTermEndTime(creditLine: CreditLine): Promise<boolean> {
    return isAfterTermEndTime(creditLine.id);
  },
  async interestOwed(creditLine: CreditLine): Promise<BigNumber> {
    return interestOwed(creditLine.id);
  },
};

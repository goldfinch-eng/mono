import { Resolvers } from "@apollo/client";
import { getProvider } from "@wagmi/core";
import { BigNumber } from "ethers";

import { getContract2 } from "@/lib/contracts";
import { CreditLine } from "@/lib/graphql/generated";

export async function interestOwed(
  creditLineAddress: string
): Promise<BigNumber> {
  const creditLineContract = await getContract2({
    name: "CreditLine",
    address: creditLineAddress,
  });

  return await creditLineContract.interestOwed();
}

export async function isAfterTermEndTime(
  creditLineAddress: string
): Promise<boolean> {
  const provider = getProvider();
  const creditLineContract = await getContract2({
    name: "CreditLine",
    address: creditLineAddress,
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
  const usdcContract = await getContract2({ name: "USDC" });
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

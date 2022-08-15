import { Resolvers } from "@apollo/client";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { CreditLine } from "../generated";

export const creditLineResolvers: Resolvers[string] = {
  async isLate(creditLine: CreditLine): Promise<boolean | null> {
    const provider = await getProvider();
    if (!provider) {
      return null;
    }
    if (!creditLine.id) {
      throw new Error("CreditLine ID unavailable when querying isLate");
    }
    const chainId = await provider.getSigner().getChainId();
    const creditLineContract = getContract({
      name: "CreditLine",
      address: creditLine.id,
      provider,
      chainId,
    });
    try {
      return await creditLineContract.isLate();
    } catch (e) {
      return null;
    }
  },
};

import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

export const seniorPoolWithdrawalRequestResolvers: Resolvers[string] = {
  async tokenId(): Promise<BigNumber> {
    const provider = await getProvider();
    const account = await provider.getSigner().getAddress();
    const withdrawalTokenContract = await getContract({
      name: "WithdrawalRequestToken",
      provider,
    });
    const tokenId = withdrawalTokenContract.tokenOfOwnerByIndex(account, 0);
    return tokenId;
  },
};

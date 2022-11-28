import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { SeniorPoolWithdrawalRequest } from "../generated";

export const seniorPoolWithdrawalRequestResolvers: Resolvers[string] = {
  async tokenId(
    withdrawalRequest: SeniorPoolWithdrawalRequest
  ): Promise<BigNumber> {
    const provider = await getProvider();
    const account = withdrawalRequest.id;
    const withdrawalTokenContract = await getContract({
      name: "WithdrawalRequestToken",
      provider,
    });
    const tokenId = withdrawalTokenContract.tokenOfOwnerByIndex(account, 0);
    return tokenId;
  },
};

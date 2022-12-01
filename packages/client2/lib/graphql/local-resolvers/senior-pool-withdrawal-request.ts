import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { SeniorPoolWithdrawalRequest } from "../generated";

export const seniorPoolWithdrawalRequestResolvers: Resolvers[string] = {
  async previewUsdcWithdrawable(
    withdrawalRequest: SeniorPoolWithdrawalRequest
  ): Promise<BigNumber> {
    const tokenId = withdrawalRequest.tokenId;
    const provider = await getProvider();
    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
      useSigner: false,
    });
    const preview = await seniorPoolContract.withdrawalRequest(tokenId);
    return preview.usdcWithdrawable;
  },
  async previewFiduRequested(
    withdrawalRequest: SeniorPoolWithdrawalRequest
  ): Promise<BigNumber> {
    const tokenId = withdrawalRequest.tokenId;
    const provider = await getProvider();
    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
      useSigner: false,
    });
    const preview = await seniorPoolContract.withdrawalRequest(tokenId);
    return preview.fiduRequested;
  },
};

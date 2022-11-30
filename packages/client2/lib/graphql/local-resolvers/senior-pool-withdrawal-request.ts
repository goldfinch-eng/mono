import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { SeniorPoolWithdrawalRequest } from "../generated";

async function getWithdrawalTokenId(account: string): Promise<BigNumber> {
  const provider = await getProvider();
  const withdrawalTokenContract = await getContract({
    name: "WithdrawalRequestToken",
    provider,
  });
  const tokenId = withdrawalTokenContract.tokenOfOwnerByIndex(account, 0);
  return tokenId;
}

export const seniorPoolWithdrawalRequestResolvers: Resolvers[string] = {
  async tokenId(
    withdrawalRequest: SeniorPoolWithdrawalRequest
  ): Promise<BigNumber> {
    return getWithdrawalTokenId(withdrawalRequest.id); // Recall that withdrawalRequest.id is equal to the owner's address
  },
  async previewUsdcWithdrawable(
    withdrawalRequest: SeniorPoolWithdrawalRequest
  ): Promise<BigNumber> {
    const tokenId = await getWithdrawalTokenId(withdrawalRequest.id);
    const provider = await getProvider();
    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
    });
    const preview = await seniorPoolContract.withdrawalRequest(tokenId);
    return preview.usdcWithdrawable;
  },
  async previewFiduRequested(
    withdrawalRequest: SeniorPoolWithdrawalRequest
  ): Promise<BigNumber> {
    const tokenId = await getWithdrawalTokenId(withdrawalRequest.id);
    const provider = await getProvider();
    const seniorPoolContract = await getContract({
      name: "SeniorPool",
      provider,
    });
    const preview = await seniorPoolContract.withdrawalRequest(tokenId);
    return preview.fiduRequested;
  },
};

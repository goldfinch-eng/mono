import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { PoolToken } from "../generated";

async function availableToWithdraw(poolToken: PoolToken) {
  const provider = await getProvider();
  const poolTokensContract = await getContract({
    name: "PoolTokens",
    provider,
    useSigner: false,
  });

  const poolAddress =
    poolToken.loan?.id ?? // trying to use loan.id and loan.address is an optional optimization that can save the getTokenInfo() RPC call. Not a strict requirement for the query writer
    poolToken.loan?.address ??
    (await poolTokensContract.getTokenInfo(poolToken.id))[0];
  const loanContract = await getContract({
    name: "TranchedPool",
    address: poolAddress,
    provider,
    useSigner: false,
  });
  const availableToWithdrawResult = await loanContract.availableToWithdraw(
    poolToken.id
  );
  return {
    interest: availableToWithdrawResult[0],
    principal: availableToWithdrawResult[1],
  };
}

export const poolTokenResolvers: Resolvers[string] = {
  async principalRedeemable(poolToken: PoolToken): Promise<BigNumber> {
    return (await availableToWithdraw(poolToken)).principal;
  },
};

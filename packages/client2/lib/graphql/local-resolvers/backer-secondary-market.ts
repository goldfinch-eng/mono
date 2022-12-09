import { Resolvers } from "@apollo/client";

import { CONTRACT_ADDRESSES } from "@/constants/contract-addresses";

import { BackerSecondaryMarket, BackerSecondaryMarketStat } from "../generated";

export async function fetchBackerSecondaryMarketStat(
  poolAddress?: string
): Promise<{ tokenCount: number; onSaleCount: number }> {
  const poolTokensAddress = CONTRACT_ADDRESSES.PoolTokens;
  const reservoirUrl = `https://api.reservoir.tools/stats/v1?collection=${poolTokensAddress}`;
  const attributeParam = poolAddress
    ? `&attributes[Pool+Address]=${poolAddress}`
    : "";

  const reservoirResponse = await (
    await fetch(`${reservoirUrl}${attributeParam}`)
  ).json();

  if (
    !reservoirResponse ||
    !reservoirResponse.stats ||
    typeof reservoirResponse.stats.tokenCount !== "number" ||
    typeof reservoirResponse.stats.onSaleCount !== "number"
  ) {
    throw new Error(
      `Reservoir response JSON failed type guard: ${reservoirResponse}`
    );
  }

  return {
    tokenCount: reservoirResponse.stats.tokenCount,
    onSaleCount: reservoirResponse.stats.onSaleCount,
  };
}

export const backerSecondaryMarketResolvers: Resolvers[string] = {
  async poolStats(
    bsm: BackerSecondaryMarket,
    args: { poolAddress?: string }
  ): Promise<BackerSecondaryMarketStat> {
    const { tokenCount, onSaleCount } = await fetchBackerSecondaryMarketStat(
      args.poolAddress
    );
    return {
      __typename: "BackerSecondaryMarketStat",
      tokenCount,
      onSaleCount,
    };
  },
};

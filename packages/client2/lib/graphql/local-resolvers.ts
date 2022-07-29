import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { TOKEN_LAUNCH_TIME } from "@/constants";

import { getContract } from "../contracts";
import { grantComparator } from "../gfi-rewards";
import { getProvider } from "../wallet";
import {
  GfiPrice,
  SupportedCrypto,
  SupportedFiat,
  Viewer,
  CryptoAmount,
  BlockInfo,
  CreditLine,
  GfiGrant,
} from "./generated";

async function fetchCoingeckoPrice(fiat: SupportedFiat): Promise<number> {
  const key = fiat.toLowerCase();
  const coingeckoResponse = await (
    await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=goldfinch&vs_currencies=${key}`
    )
  ).json();

  if (
    !coingeckoResponse ||
    !coingeckoResponse.goldfinch ||
    !coingeckoResponse.goldfinch[key] ||
    typeof coingeckoResponse.goldfinch[key] !== "number"
  ) {
    throw new Error("Coingecko response JSON failed type guard");
  }
  return coingeckoResponse.goldfinch[key];
}

async function fetchCoinbasePrice(fiat: SupportedFiat): Promise<number> {
  const key = fiat.toUpperCase();
  const coinbaseResponse = await (
    await fetch(`https://api.coinbase.com/v2/prices/GFI-${key}/spot`)
  ).json();

  if (
    !coinbaseResponse ||
    !coinbaseResponse.data ||
    !coinbaseResponse.data.amount
  ) {
    throw new Error("Coinbase response JSON failed type guard");
  }
  return parseFloat(coinbaseResponse.data.amount);
}

async function fetchGfiPrice(fiat: SupportedFiat): Promise<number> {
  try {
    return await fetchCoingeckoPrice(fiat);
  } catch (e) {
    return await fetchCoinbasePrice(fiat);
  }
}

export const resolvers: Resolvers = {
  Query: {
    async gfiPrice(_, args: { fiat: SupportedFiat }): Promise<GfiPrice> {
      const fiat = args.fiat;
      const amount = await fetchGfiPrice(fiat);
      return {
        __typename: "GfiPrice", // returning typename is very important, since this is meant to be a whole type and not just a scalar. Without this, it won't enter the cache properly as a normalized entry
        lastUpdated: Date.now(),
        price: { __typename: "FiatAmount", symbol: fiat, amount },
      };
    },
    async viewer(): Promise<Partial<Viewer>> {
      const provider = await getProvider();
      if (!provider) {
        return {
          __typename: "Viewer",
          account: null,
        };
      }

      const account = await provider.getSigner().getAddress();
      return {
        __typename: "Viewer",
        account,
      };
    },
    async currentBlock(): Promise<BlockInfo | null> {
      const provider = await getProvider();
      if (!provider) {
        return null;
      }
      const currentBlock = await provider.getBlock("latest");
      return {
        __typename: "BlockInfo",
        number: currentBlock.number,
        timestamp: currentBlock.timestamp,
      };
    },
  },
  Viewer: {
    account(viewer: Viewer, args: { format: "lowercase" }) {
      if (!viewer || !viewer.account) {
        return null;
      }
      const format = args?.format;
      if (format === "lowercase") {
        return viewer.account.toLowerCase();
      }
      return viewer.account;
    },
    async gfiBalance(): Promise<CryptoAmount | null> {
      const provider = await getProvider();
      if (!provider) {
        return null;
      }
      const account = await provider.getSigner().getAddress();
      const chainId = await provider.getSigner().getChainId();

      const gfiContract = getContract({ name: "GFI", chainId, provider });
      const gfiBalance = await gfiContract.balanceOf(account);
      return {
        __typename: "CryptoAmount",
        token: SupportedCrypto.Gfi,
        amount: gfiBalance,
      };
    },
    async usdcBalance(): Promise<CryptoAmount | null> {
      const provider = await getProvider();
      if (!provider) {
        return null;
      }
      const account = await provider.getSigner().getAddress();
      const chainId = await provider.getSigner().getChainId();

      const usdcContract = getContract({ name: "USDC", chainId, provider });
      const usdcBalance = await usdcContract.balanceOf(account);
      return {
        __typename: "CryptoAmount",
        token: SupportedCrypto.Usdc,
        amount: usdcBalance,
      };
    },
    async fiduBalance(): Promise<CryptoAmount | null> {
      const provider = await getProvider();
      if (!provider) {
        return null;
      }
      const account = await provider.getSigner().getAddress();
      const chainId = await provider.getSigner().getChainId();

      const fiduContract = getContract({ name: "Fidu", chainId, provider });
      const fiduBalance = await fiduContract.balanceOf(account);
      return {
        __typename: "CryptoAmount",
        token: SupportedCrypto.Fidu,
        amount: fiduBalance,
      };
    },
    async gfiGrants(viewer: Viewer): Promise<Omit<GfiGrant, "claimable">[]> {
      if (!viewer || !viewer.account) {
        return [];
      }

      const matchingGrantsFromEndpoint = await (
        await fetch(`/api/gfi-grants?account=${viewer.account}`)
      ).json();
      const gfiGrants: Omit<GfiGrant, "claimable">[] = [];
      for (const g of matchingGrantsFromEndpoint.matchingGrants) {
        gfiGrants.push({
          __typename: "GfiGrant",
          id: `${g.source}${g.index}`,
          index: g.index,
          source: g.source,
          reason: g.reason.toUpperCase(),
          proof: g.proof,
          amount: BigNumber.from(g.grant.amount),
          vestingLength: g.grant.vestingLength
            ? BigNumber.from(g.grant.vestingLength)
            : null,
          vestingInterval: g.grant.vestingInterval
            ? BigNumber.from(g.grant.vestingInterval)
            : null,
          cliffLength: g.grant.cliffLength
            ? BigNumber.from(g.grant.cliffLength)
            : null,
          start: BigNumber.from(TOKEN_LAUNCH_TIME),
          end: g.grant.vestingLength
            ? BigNumber.from(TOKEN_LAUNCH_TIME).add(
                BigNumber.from(g.grant.vestingLength)
              )
            : BigNumber.from(TOKEN_LAUNCH_TIME),
        });
      }

      gfiGrants.sort(grantComparator);

      return gfiGrants;
    },
  },
  CreditLine: {
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
  },
  GfiGrant: {
    async claimable(gfiGrant: GfiGrant): Promise<BigNumber> {
      if (
        !gfiGrant.vestingLength ||
        !gfiGrant.cliffLength ||
        !gfiGrant.vestingInterval
      ) {
        return gfiGrant.amount;
      }

      const provider = await getProvider();
      if (!provider) {
        throw new Error(
          "No connected provider when calculating claimable for a GfiGrant"
        );
      }
      const chainId = await provider.getSigner().getChainId();
      const communityRewardsContract = getContract({
        name: "CommunityRewards",
        chainId,
        provider,
      });
      const claimable = await communityRewardsContract.totalVestedAt(
        gfiGrant.start,
        gfiGrant.end,
        gfiGrant.amount,
        gfiGrant.cliffLength,
        gfiGrant.vestingInterval,
        BigNumber.from(0),
        (
          await provider.getBlock("latest")
        ).timestamp
      );

      return claimable;
    },
  },
};

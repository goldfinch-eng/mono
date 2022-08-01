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
  IndirectGfiGrant,
  DirectGfiGrant,
  GrantSource,
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
    async gfiGrants(viewer: Viewer) {
      if (!viewer || !viewer.account) {
        return [];
      }

      const matchingGrantsFromEndpoint = await (
        await fetch(`/api/gfi-grants?account=${viewer.account}`)
      ).json();
      const gfiGrants = [];
      for (const g of matchingGrantsFromEndpoint.matchingGrants) {
        if (
          g.grant.vestingLength &&
          g.grant.vestingInterval &&
          g.grant.cliffLength
        ) {
          gfiGrants.push({
            __typename: "IndirectGfiGrant",
            id: `${g.source}${g.index}`,
            index: g.index,
            source: g.source,
            reason: g.reason.toUpperCase(),
            proof: g.proof,
            amount: BigNumber.from(g.grant.amount),
            vestingLength: BigNumber.from(g.grant.vestingLength),
            vestingInterval: BigNumber.from(g.grant.vestingInterval),
            cliffLength: BigNumber.from(g.grant.cliffLength),
            start: BigNumber.from(TOKEN_LAUNCH_TIME),
            end: BigNumber.from(TOKEN_LAUNCH_TIME).add(
              BigNumber.from(g.grant.vestingLength)
            ),
          } as Omit<IndirectGfiGrant, "vested">);
        } else {
          gfiGrants.push({
            __typename: "DirectGfiGrant",
            id: `${g.source}${g.index}`,
            index: g.index,
            source: g.source,
            reason: g.reason.toUpperCase(),
            proof: g.proof,
            amount: BigNumber.from(g.grant.amount),
          } as Omit<DirectGfiGrant, "isAccepted">);
        }
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
  IndirectGfiGrant: {
    async vested(indirectGfiGrant: IndirectGfiGrant): Promise<BigNumber> {
      const provider = await getProvider();
      if (!provider) {
        throw new Error(
          "No connected provider when calculating vested amount for a GfiGrant"
        );
      }
      const chainId = await provider.getSigner().getChainId();
      const communityRewardsContract = getContract({
        name: "CommunityRewards",
        chainId,
        provider,
      });
      const vested = await communityRewardsContract.totalVestedAt(
        indirectGfiGrant.start,
        indirectGfiGrant.end,
        indirectGfiGrant.amount,
        indirectGfiGrant.cliffLength,
        indirectGfiGrant.vestingInterval,
        BigNumber.from(0),
        (
          await provider.getBlock("latest")
        ).timestamp
      );

      return vested;
    },
  },
  DirectGfiGrant: {
    async isAccepted(gfiDirectGrant: DirectGfiGrant): Promise<boolean> {
      const provider = await getProvider();
      if (!provider) {
        throw new Error(
          "No connected provider when checking `isAccepted` on GfiDirectGrant"
        );
      }
      const chainId = await provider.getSigner().getChainId();
      if (gfiDirectGrant.source === GrantSource.MerkleDirectDistributor) {
        const merkleDirectDistributorContract = getContract({
          name: "MerkleDirectDistributor",
          chainId,
          provider,
        });
        const isAccepted =
          await merkleDirectDistributorContract.isGrantAccepted(
            gfiDirectGrant.index
          );
        return isAccepted;
      } else if (
        gfiDirectGrant.source === GrantSource.BackerMerkleDirectDistributor
      ) {
        const backerMerkleDirectDistributorContract = getContract({
          name: "BackerMerkleDirectDistributor",
          chainId,
          provider,
        });
        const isAccepted =
          await backerMerkleDirectDistributorContract.isGrantAccepted(
            gfiDirectGrant.index
          );
        return isAccepted;
      } else {
        throw new Error(
          "Unreachable block in GfiDirectGrant.isAccepted resolver"
        );
      }
    },
  },
};

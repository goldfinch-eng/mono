import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { TOKEN_LAUNCH_TIME } from "@/constants";
import { getContract } from "@/lib/contracts";
import { grantComparator } from "@/lib/gfi-rewards";
import { getProvider } from "@/lib/wallet";

import {
  Viewer,
  SupportedCrypto,
  CryptoAmount,
  IndirectGfiGrant,
  DirectGfiGrant,
} from "../generated";

export const viewerResolvers: Resolvers[string] = {
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
};

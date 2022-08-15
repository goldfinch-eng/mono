import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { TOKEN_LAUNCH_TIME } from "@/constants";
import { getContract } from "@/lib/contracts";
import { grantComparator } from "@/lib/gfi-rewards";
import { assertUnreachable } from "@/lib/utils";
import { getProvider } from "@/lib/wallet";

import {
  Viewer,
  SupportedCrypto,
  CryptoAmount,
  IndirectGfiGrant,
  DirectGfiGrant,
} from "../generated";

async function erc20Balance(
  token: Exclude<SupportedCrypto, SupportedCrypto.CurveLp> // curve lp token could be added later
): Promise<CryptoAmount | null> {
  const provider = await getProvider();
  if (!provider) {
    return null;
  }
  const account = await provider.getSigner().getAddress();
  const chainId = await provider.getSigner().getChainId();

  const contract = getContract({
    name:
      token === SupportedCrypto.Gfi
        ? "GFI"
        : token === SupportedCrypto.Usdc
        ? "USDC"
        : token === SupportedCrypto.Fidu
        ? "Fidu"
        : assertUnreachable(token),
    chainId,
    provider,
  });
  const balance = await contract.balanceOf(account);
  return { __typename: "CryptoAmount", token, amount: balance };
}

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
    return erc20Balance(SupportedCrypto.Gfi);
  },
  async usdcBalance(): Promise<CryptoAmount | null> {
    return erc20Balance(SupportedCrypto.Usdc);
  },
  async fiduBalance(): Promise<CryptoAmount | null> {
    return erc20Balance(SupportedCrypto.Fidu);
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
          indirectSource: g.source,
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
        } as Required<Omit<IndirectGfiGrant, "vested">>);
      } else {
        gfiGrants.push({
          __typename: "DirectGfiGrant",
          id: `${g.source}${g.index}`,
          index: g.index,
          directSource: g.source,
          reason: g.reason.toUpperCase(),
          proof: g.proof,
          amount: BigNumber.from(g.grant.amount),
        } as Required<Omit<DirectGfiGrant, "isAccepted">>);
      }
    }

    gfiGrants.sort(grantComparator);

    return gfiGrants;
  },
};

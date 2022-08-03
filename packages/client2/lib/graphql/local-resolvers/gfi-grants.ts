import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { DirectGfiGrant, GrantSource, IndirectGfiGrant } from "../generated";

export const indirectGfiGrantResolvers: Resolvers[string] = {
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
};

export const directGfiGrantResolvers: Resolvers[string] = {
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
      const isAccepted = await merkleDirectDistributorContract.isGrantAccepted(
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
};

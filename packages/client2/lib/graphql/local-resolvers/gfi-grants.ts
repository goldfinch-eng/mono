import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { assertUnreachable } from "@/lib/utils";
import { getProvider } from "@/lib/wallet";

import {
  DirectGfiGrant,
  DirectGrantSource,
  IndirectGfiGrant,
} from "../generated";

export const indirectGfiGrantResolvers: Resolvers[string] = {
  async vested(indirectGfiGrant: IndirectGfiGrant): Promise<BigNumber> {
    const provider = await getProvider();
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
    const chainId = await provider.getSigner().getChainId();
    switch (gfiDirectGrant.directSource) {
      case DirectGrantSource.MerkleDirectDistributor:
        const merkleDirectDistributorContract = getContract({
          name: "MerkleDirectDistributor",
          chainId,
          provider,
        });
        return await merkleDirectDistributorContract.isGrantAccepted(
          gfiDirectGrant.index
        );
      case DirectGrantSource.BackerMerkleDirectDistributor:
        const backerMerkleDirectDistributorContract = getContract({
          name: "BackerMerkleDirectDistributor",
          chainId,
          provider,
        });
        return backerMerkleDirectDistributorContract.isGrantAccepted(
          gfiDirectGrant.index
        );
      default:
        assertUnreachable(gfiDirectGrant.directSource);
    }
  },
};

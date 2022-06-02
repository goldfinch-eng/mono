import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import { useWallet } from "@/lib/wallet";
import { StakingRewards__factory } from "@/types/ethers-contracts";

export function useStakingRewardsContract() {
  const { provider, chainId } = useWallet();
  return useMemo(() => {
    if (provider && chainId) {
      const stakingRewardsAddress = CONTRACT_ADDRESSES[chainId].StakingRewards;
      const stakingRewardsContract = StakingRewards__factory.connect(
        stakingRewardsAddress,
        provider.getSigner()
      );
      return { stakingRewardsAddress, stakingRewardsContract };
    }
    return {
      stakingRewardsAddress: undefined,
      stakingRewardsContract: undefined,
    };
  }, [provider, chainId]);
}

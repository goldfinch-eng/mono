import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import { useWallet } from "@/lib/wallet";
import { SeniorPool__factory } from "@/types/ethers-contracts";

export function useSeniorPoolContract() {
  const { provider, chainId } = useWallet();
  return useMemo(() => {
    if (provider && chainId) {
      const seniorPoolAddress = CONTRACT_ADDRESSES[chainId].SeniorPool;
      const seniorPoolContract = SeniorPool__factory.connect(
        seniorPoolAddress,
        provider.getSigner()
      );
      return { seniorPoolAddress, seniorPoolContract };
    }
    return { seniorPoolAddress: undefined, seniorPoolContract: undefined };
  }, [provider, chainId]);
}

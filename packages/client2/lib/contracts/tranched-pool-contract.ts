import { useMemo } from "react";

import { useWallet } from "@/lib/wallet";
import { TranchedPool__factory } from "@/types/ethers-contracts";

export function useTranchedPoolContract(tranchedPoolAddress: string) {
  const { provider } = useWallet();
  return useMemo(() => {
    if (provider) {
      const tranchedPoolContract = TranchedPool__factory.connect(
        tranchedPoolAddress,
        provider.getSigner()
      );
      return { tranchedPoolContract };
    }
    return { tranchedPoolContract: undefined };
  }, [provider, tranchedPoolAddress]);
}

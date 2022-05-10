import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import { useWallet } from "@/lib/wallet";
import { Gfi__factory } from "@/types/ethers-contracts";

export function useGfiContract() {
  const { provider, chainId } = useWallet();
  return useMemo(() => {
    if (provider && chainId) {
      const gfiAddress = CONTRACT_ADDRESSES[chainId].GFI;
      const gfiContract = Gfi__factory.connect(
        gfiAddress,
        provider.getSigner()
      );
      return { gfiAddress, gfiContract };
    }
    return { gfiAddress: undefined, gfiContract: undefined };
  }, [provider, chainId]);
}

import { Web3Provider } from "@ethersproject/providers";
import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import { useWallet } from "@/lib/wallet";
import { Fidu__factory } from "@/types/ethers-contracts";

export function useFiduContract() {
  const { provider, chainId } = useWallet();
  return useMemo(() => {
    if (provider && chainId) {
      const fiduAddress = CONTRACT_ADDRESSES[chainId].Fidu;
      const fiduContract = Fidu__factory.connect(
        fiduAddress,
        provider.getSigner()
      );
      return { fiduAddress, fiduContract };
    }
    return { fiduAddress: undefined, fiduContract: undefined };
  }, [provider, chainId]);
}

export async function getFiduContract(chainId: number, provider: Web3Provider) {
  const fiduAddress = CONTRACT_ADDRESSES[chainId].Fidu;
  const fiduContract = Fidu__factory.connect(fiduAddress, provider);
  return fiduContract;
}

import { Web3Provider } from "@ethersproject/providers";
import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import { useWallet } from "@/lib/wallet";
import { UniqueIdentity__factory } from "@/types/ethers-contracts";

export function useUidContract() {
  const { provider, chainId } = useWallet();
  return useMemo(() => {
    if (provider && chainId) {
      const uidAddress = CONTRACT_ADDRESSES[chainId].UniqueIdentity;
      const uidContract = UniqueIdentity__factory.connect(
        uidAddress,
        provider.getSigner()
      );
      return { uidAddress, uidContract };
    }
    return { uidAddress: undefined, uidContract: undefined };
  }, [provider, chainId]);
}

export async function getUidContract(chainId: number, provider: Web3Provider) {
  const uidAddress = CONTRACT_ADDRESSES[chainId].UniqueIdentity;
  const uidContract = UniqueIdentity__factory.connect(uidAddress, provider);
  return uidContract;
}

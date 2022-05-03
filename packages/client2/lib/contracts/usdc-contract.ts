import { Web3Provider } from "@ethersproject/providers";
import { useMemo } from "react";

import { CONTRACT_ADDRESSES } from "@/constants";
import { useWallet } from "@/lib/wallet";
import { Erc20__factory } from "@/types/ethers-contracts";

export function useUsdcContract() {
  const { provider, chainId } = useWallet();
  return useMemo(() => {
    if (provider && chainId) {
      const usdcAddress = CONTRACT_ADDRESSES[chainId].USDC;
      const usdcContract = Erc20__factory.connect(
        usdcAddress,
        provider.getSigner()
      );
      return { usdcAddress, usdcContract };
    }
    return { usdcAddress: undefined, usdcContract: undefined };
  }, [provider, chainId]);
}

export async function getUsdcContract(chainId: number, provider: Web3Provider) {
  const usdcAddress = CONTRACT_ADDRESSES[chainId].USDC;
  const usdcContract = Erc20__factory.connect(usdcAddress, provider);
  return usdcContract;
}

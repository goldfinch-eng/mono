import { CONTRACT_ADDRESSES } from "@/constants";
import { useWallet } from "@/lib/wallet";
import { Erc20__factory } from "@/types/ethers-contracts";

export function useUsdcContract() {
  const { provider, chainId } = useWallet();
  if (provider && chainId) {
    const usdcAddress = CONTRACT_ADDRESSES[chainId].USDC;
    const contract = Erc20__factory.connect(usdcAddress, provider.getSigner());
    return contract;
  }
}

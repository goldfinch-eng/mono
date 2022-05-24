import { Web3Provider } from "@ethersproject/providers";

import { CONTRACT_ADDRESSES } from "@/constants";
import { Go__factory } from "@/types/ethers-contracts";

export async function getGoContract(chainId: number, provider: Web3Provider) {
  const goAddress = CONTRACT_ADDRESSES[chainId].Go;
  return Go__factory.connect(goAddress, provider);
}

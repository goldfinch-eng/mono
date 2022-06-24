import { Web3Provider } from "@ethersproject/providers";
import { utils } from "ethers";

export * from "./get-wallet";
export * from "./use-wallet";

/**
 * Simple utility function that takes an ethereum address and returns an abbreviated version. Example: 0x76C367b14bFEf90B4066bb46dbd66a02cE581312 -> 0x76C3...1312
 */
export function abbreviateAddress(address: string) {
  return (
    address.substring(0, 6) + "..." + address.substring(address.length - 4)
  );
}

/**
 * Determines whether or not a given address is a smart contract.
 */
export async function isSmartContract(address: string, provider: Web3Provider) {
  const bytecode = await provider.getCode(address);
  return utils.hexStripZeros(bytecode) !== "0x";
}

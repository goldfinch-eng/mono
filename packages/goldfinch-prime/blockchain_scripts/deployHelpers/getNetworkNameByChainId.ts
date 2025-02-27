import {SupportedNetwork} from "."

export function getNetworkNameByChainId(chainId: number): SupportedNetwork {
  switch (chainId) {
    case 8453:
      return "base"
    case 84532:
      return "baseSepolia"
    default:
      throw new Error(`Unknown chainId ${chainId}`)
  }
}

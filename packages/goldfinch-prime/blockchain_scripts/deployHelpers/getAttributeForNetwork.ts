import {SupportedNetwork} from "."

export type Attribute = "CCTP Domain" | "Fork Block Number" | "Rpc Url"

export class AttributeDoesNotExistError extends Error {
  public readonly attributeName: string
  public readonly network: string
  constructor(attributeName: string, network: string) {
    super(`Attribute '${attributeName}' not found for network '${network}'`)
    this.attributeName = attributeName
    this.network = network
  }
}

export function getAttributeForNetwork(attribute: Attribute, network: SupportedNetwork, fallback?: any): string {
  // NOTE: if you need to add a new attribute, do it here
  const attributeToNetworkMap: Record<Attribute, Partial<Record<SupportedNetwork, any>>> = {
    // Found here: https://developers.circle.com/stablecoins/docs/cctp-technical-reference
    "CCTP Domain": {
      base: 6,
      baseGoerli: 6,
      baseSepolia: 6,
    },
    "Fork Block Number": {
      // Jan-14-2025 1:54:00 PM +UTC
      base: 25051143,
      baseSepolia: 7776053,
    },
    "Rpc Url": {
      base: process.env.BASE_CHAINPROVIDER_URL,
      baseSepolia: process.env.BASE_SEPOLIA_CHAINPROVIDER_URL,
    },
  }

  const networkToValue = attributeToNetworkMap[attribute]
  if (networkToValue == undefined) {
    if (fallback !== undefined) {
      return fallback
    }

    throw new Error(`Attribute '${attribute}' is unknown`)
  }

  const maybeAttributeValue = networkToValue[network]
  if (maybeAttributeValue == undefined) {
    if (fallback !== undefined) {
      return fallback
    }

    throw new AttributeDoesNotExistError(attribute, network)
  }

  return maybeAttributeValue
}

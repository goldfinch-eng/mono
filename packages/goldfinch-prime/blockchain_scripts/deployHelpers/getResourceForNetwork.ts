import {TEST_MNEMONIC_ACCOUNTS} from "@goldfinch-eng/goldfinch-prime/config/testMnemonic"

import {SupportedNetwork} from "./index"

export type ApplicationResource =
  | "CCTP Sweeper Relayer"
  | "Protocol Owner"
  | "USDC"
  | "Unique Identity Signer"
  | "Warbler Advisory Fee Collection Multisig"
  | "Warbler Advisory Rebalancer Multisig"
  | "Warbler Labs Operational Multisig"
  | "Warbler Lending Repayments Multisig"
  | "Warbler Lending Portfolio Owner Multisig"
  | "Warbler Lending Portfolio ID"
  | "CCTP Token Messenger"

export class ResourceDoesNotExistError extends Error {
  public readonly resourceName: string
  public readonly network: string
  constructor(resourceName: string, network: string) {
    super(`'${resourceName}' not found for network '${network}'`)
    this.resourceName = resourceName
    this.network = network
  }
}

const BASE_SEPOLIA_OWNER_MULTISIG = "0x502DD7Ea171b7803b0F5ED59285D7A0114b8d9Fd"

/// Returns the address for a given resource on a given network
///   Resources could be multisigs like governance or important contracts like USDC
export function getResourceAddressForNetwork(resourceName: ApplicationResource, network: SupportedNetwork): string {
  const resourceToNetworksMap: Record<ApplicationResource, Partial<Record<SupportedNetwork, string>>> = {
    USDC: {
      mainnet: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      // Testnet addresses found here: https://developers.circle.com/stablecoins/docs/usdc-on-testing-networks
      baseGoerli: "0xf175520c52418dfe19c8098071a252da48cd1c19",
      arbitrumGoerli: "0xfd064a18f3bf249cf1f87fc203e90d8f650f2d63",
      baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
    "Unique Identity Signer": {
      base: "0xf146FcF64D625a25273D3317767B3C2c17F44Ef0",
      baseSepolia: "0x91f6fB0b918afd7401414e56C74f15A87724398b",
      localhost: TEST_MNEMONIC_ACCOUNTS[2],
    },
    "CCTP Token Messenger": {
      base: "0xe45B133ddc64bE80252b0e9c75A8E74EF280eEd6",
      baseSepolia: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
      baseGoerli: "0x877b8e8c9e2383077809787ED6F279ce01CB4cc8",
      arbitrum: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
      arbitrumGoerli: "0x12dcfd3fe2e9eac2859fd1ed86d2ab8c5a2f9352",
    },
    "Protocol Owner": {
      mainnet: "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f",
      // https://www.notion.so/goldfinchfinance/Crypto-Addresses-75a869942e804e7fa2cbe90fb32233f2?pvs=4#26388609ada74255a7b55b8644eb99d4
      base: "0x809521D2a1FE066f37280C87403Cf60e5Ed53dA4",
      arbitrum: "0xd3d5DA2B33cDef75f0A9f9d703A8FB2f01b69DC2",
      arbitrumGoerli: "0xc671327284B3B9f9F546146bC7048A20514DFc9C",
      baseGoerli: "0xc671327284B3B9f9F546146bC7048A20514DFc9C",
      baseSepolia: BASE_SEPOLIA_OWNER_MULTISIG,
    },
    "Warbler Advisory Fee Collection Multisig": {
      base: "0x8C1a49346DD6d6225Fc3c492bc046527cEdd8238",
      baseSepolia: BASE_SEPOLIA_OWNER_MULTISIG, // Same as protocol owner
    },
    "Warbler Advisory Rebalancer Multisig": {
      base: "0xEDb36057118792c29593Ed3A3610e1A5C3164289",
      baseSepolia: BASE_SEPOLIA_OWNER_MULTISIG, // Same as protocol owner
    },
    "Warbler Lending Portfolio ID": {
      base: "0",
      baseSepolia: "9",
    },
    "Warbler Lending Portfolio Owner Multisig": {
      base: "0x9817fB8Db3C1F65Feaa07a297DC37580eD588183",
      baseSepolia: BASE_SEPOLIA_OWNER_MULTISIG, // Same as protocol owner
    },
    "Warbler Labs Operational Multisig": {
      mainnet: "0x4eba8F71CE24407093c436B0085df226925b118e",
      base: "0x25d69fD725731dE8EFC66989c4E1c7E4ea0AaB07",
      arbitrum: "0xd3d5DA2B33cDef75f0A9f9d703A8FB2f01b69DC2",
      baseSepolia: BASE_SEPOLIA_OWNER_MULTISIG, // Same as protocol owner
    },
    "Warbler Lending Repayments Multisig": {
      base: "0x46cC6418bf12933E4afCF95ae255E8249FFfD0D9",
      baseSepolia: BASE_SEPOLIA_OWNER_MULTISIG, // Same as protocol owner
    },
    "CCTP Sweeper Relayer": {
      arbitrumGoerli: "0x5F03a13F6304FC82a57F079101fC0CB88c100EC4",
      arbitrum: "0xb84dAB07C1dF24a57Ea026E750E3c715A7bC4788",
      baseSepolia: "0x4Fc9E54861763F896C781Bf0bc5247f998F39cB4",
    },
  }

  const networkToAddressMap = resourceToNetworksMap[resourceName]
  if (networkToAddressMap == undefined) {
    throw new Error(`Resource '${resourceName}' is unknown`)
  }

  const maybeResourceAddress = networkToAddressMap[network]
  if (maybeResourceAddress == undefined) {
    throw new ResourceDoesNotExistError(resourceName, network)
  }

  return maybeResourceAddress
}

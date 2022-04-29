import localhostMetadata from "./metadata/localhost.json";
import { mainnetMetadata } from "./metadata/mainnet";
export * from "./contract-addresses";

export const POOL_METADATA =
  process.env.NEXT_PUBLIC_POOL_METADATA_NETWORK === "mainnet"
    ? mainnetMetadata
    : localhostMetadata;

export const USDC_DECIMALS = 6;
export const GFI_DECIMALS = 18;

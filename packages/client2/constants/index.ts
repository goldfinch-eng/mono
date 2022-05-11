import localhostMetadata from "./metadata/localhost.json";
import { mainnetMetadata } from "./metadata/mainnet";
import type { PoolMetadata } from "./metadata/types";

export * from "./contract-addresses";

export const POOL_METADATA =
  process.env.NEXT_PUBLIC_POOL_METADATA_NETWORK === "mainnet"
    ? mainnetMetadata
    : (localhostMetadata as Record<string, PoolMetadata>);

export const USDC_DECIMALS = 6;
export const GFI_DECIMALS = 18;

export const TRANCHES = {
  Senior: 1,
  Junior: 2,
};
